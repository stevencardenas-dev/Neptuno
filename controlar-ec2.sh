#!/usr/bin/env bash
# Controla la instancia EC2 de Neptuno: encender, apagar o consultar.
#
#   ./controlar-ec2.sh encender   arranca la instancia y espera a que la app responda
#   ./controlar-ec2.sh apagar     la detiene: deja de consumir horas de instancia
#   ./controlar-ec2.sh estado     muestra estado, IP y URLs
#
# Encender y apagar es la palanca de costo: las horas de instancia solo se facturan
# mientras esta en marcha. La Elastic IP se mantiene asociada aunque este detenida,
# para que el origen de CloudFront no cambie.
#
# Variables opcionales:
#   PERFIL_AWS   perfil del CLI de AWS   (por defecto: neptuno)
#   REGION_AWS   region                  (por defecto: us-east-2)
#   ETIQUETA     etiqueta Name de la EC2  (por defecto: neptuno)
set -euo pipefail

PERFIL=${PERFIL_AWS:-neptuno}
REGION=${REGION_AWS:-us-east-2}
ETIQUETA=${ETIQUETA:-neptuno}
AWS="aws --profile $PERFIL --region $REGION"
COMENTARIO_CDN=${COMENTARIO_CDN:-"Neptuno - CDN sobre la instancia EC2 (SPA y API)"}

if ! command -v aws >/dev/null; then
  echo "ERROR: falta el CLI de AWS." >&2
  exit 1
fi

# La sesion del CLI caduca. Sin esta comprobacion, un fallo de autenticacion se confunde
# con "no existe la instancia", porque el error del CLI se descarta a proposito abajo.
if ! $AWS sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: la sesion del perfil $PERFIL vencio. Ejecuta 'aws login --profile $PERFIL' y reintenta." >&2
  exit 1
fi

ID=$($AWS ec2 describe-instances \
      --filters "Name=tag:Name,Values=$ETIQUETA" \
                "Name=instance-state-name,Values=pending,running,stopping,stopped" \
      --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || true)

if [ -z "$ID" ] || [ "$ID" = "None" ]; then
  echo "ERROR: no encuentro una instancia con Name=$ETIQUETA en $REGION (perfil $PERFIL)." >&2
  exit 1
fi

dato() {
  $AWS ec2 describe-instances --instance-ids "$ID" \
    --query "Reservations[0].Instances[0].$1" --output text
}

urls() {
  local ip dns cdn
  ip=$(dato PublicIpAddress)
  dns=$(dato PublicDnsName)
  cdn=$($AWS --region us-east-1 cloudfront list-distributions \
          --query "DistributionList.Items[?Comment=='$COMENTARIO_CDN'].DomainName | [0]" \
          --output text 2>/dev/null || true)
  if [ "$ip" != "None" ]; then
    echo "  directo a la instancia:  http://$ip:8080/"
  fi
  if [ -n "$cdn" ] && [ "$cdn" != "None" ]; then
    echo "  CDN con HTTPS:           https://$cdn/"
  fi
  echo "  origen de CloudFront:    $dns"
}

# La app esta lista cuando responde nginx Y tambien el backend. Ojo: /healthz lo sirve
# nginx y contesta antes que Spring, asi que por si solo daria un "listo" enganoso.
app_lista() {
  local ip=$1 codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$ip:8080/healthz" 2>/dev/null || true)
  [ "$codigo" = "200" ] || return 1
  # 401 en actuator significa que Spring ya responde: el endpoint exige autenticacion.
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://$ip:8080/api/usuarios/actuator/health" 2>/dev/null || true)
  [ "$codigo" = "401" ] || return 1
  return 0
}

case "${1:-estado}" in
  encender)
    if [ "$(dato State.Name)" != "running" ]; then
      echo ">> Encendiendo $ID ..."
      $AWS ec2 start-instances --instance-ids "$ID" >/dev/null
      $AWS ec2 wait instance-running --instance-ids "$ID"
    else
      echo ">> $ID ya estaba en marcha."
    fi
    echo ">> Esperando a que la app responda (MySQL + Spring tardan ~1-2 min) ..."
    IP=$(dato PublicIpAddress)
    for i in $(seq 1 60); do
      if app_lista "$IP"; then
        echo ">> App lista (nginx + backend) tras ~$((i*5))s."
        urls
        exit 0
      fi
      sleep 5
    done
    echo ">> AVISO: la instancia arranco pero la app no respondio en 5 minutos." >&2
    echo ">> Revisa:  ssh -i <clave> ubuntu@$IP 'podman ps -a; systemctl --user status neptuno'" >&2
    urls
    exit 1
    ;;
  apagar)
    if [ "$(dato State.Name)" = "stopped" ]; then
      echo ">> $ID ya estaba detenida."
    else
      echo ">> Apagando $ID ..."
      $AWS ec2 stop-instances --instance-ids "$ID" >/dev/null
      $AWS ec2 wait instance-stopped --instance-ids "$ID"
    fi
    echo ">> Detenida: deja de consumir horas de instancia."
    echo ">> La Elastic IP sigue reservada para que el origen de CloudFront no cambie."
    echo "   Una IPv4 publica se factura igual, este asociada o no."
    ;;
  estado)
    $AWS ec2 describe-instances --instance-ids "$ID" \
      --query 'Reservations[0].Instances[0].{estado:State.Name,ip:PublicIpAddress,tipo:InstanceType,az:Placement.AvailabilityZone,lanzada:LaunchTime}' \
      --output table
    urls
    ;;
  *)
    echo "uso: $0 {encender|apagar|estado}" >&2
    exit 2
    ;;
esac
