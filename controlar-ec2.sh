#!/usr/bin/env bash
# Enciende y apaga Neptuno en AWS. Para el equipo.
#
#   ./controlar-ec2.sh encender   levanta la instancia y deja la app respondiendo
#   ./controlar-ec2.sh apagar     detiene la app y la instancia
#   ./controlar-ec2.sh estado     dice si la app está arriba y dónde se entra
#
# Por dentro:
#   encender  1) arranca la instancia de EC2
#             2) la app se levanta sola: en la instancia hay una unidad de
#                systemd que arranca los contenedores al iniciar la máquina
#             3) espera a que respondan la web y el backend (~1-2 min en frío)
#   apagar    1) para la instancia; al apagarse, esa misma unidad detiene los
#                contenedores en orden (la base de datos cierra sin perder datos)
#             2) deja de consumir horas de máquina
#
# Este script NO lleva ninguna credencial. Cada quien entra con su propia cuenta
# de AWS, y los secretos de la aplicación (contraseña del administrador, claves
# de las bases de datos) se quedan en la instancia, dentro de su archivo .env:
#
#   1) Instalar el CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
#   2) Entrar con tu cuenta:  aws login --profile neptuno
#      Si tu usuario todavía no está en la cuenta del proyecto, pídelo: no se
#      comparten claves ni contraseñas por el repositorio.
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

verde() { printf '\033[32m%s\033[0m\n' "$1"; }
rojo()  { printf '\033[31m%s\033[0m\n' "$1"; }

if ! command -v aws >/dev/null; then
  rojo "Falta el CLI de AWS. Instálalo con: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi

# La sesion del CLI caduca. Sin esta comprobacion, un fallo de autenticacion se confunde
# con "no existe la instancia", porque el error del CLI se descarta a proposito abajo.
if ! $AWS sts get-caller-identity >/dev/null 2>&1; then
  rojo "La sesion del perfil '$PERFIL' no esta activa. Entra con tu cuenta:  aws login --profile $PERFIL"
  exit 1
fi

ID=$($AWS ec2 describe-instances \
      --filters "Name=tag:Name,Values=$ETIQUETA" \
                "Name=instance-state-name,Values=pending,running,stopping,stopped" \
      --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || true)

if [ -z "$ID" ] || [ "$ID" = "None" ]; then
  rojo "No se encuentra una instancia con el nombre '$ETIQUETA' en $REGION (perfil $PERFIL)."
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
  echo
  verde "  Entrar a la app:"
  if [ -n "$cdn" ] && [ "$cdn" != "None" ]; then
    echo "    https://$cdn/"
  fi
  if [ "$ip" != "None" ]; then
    echo "    http://$ip:8080/   (directo a la instancia)"
  fi
  echo "    El usuario administrador y su clave estan en la instancia, en su archivo .env."
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
    echo ">> La app se levanta sola con la instancia. Esperando a que responda (MySQL + backend, ~1-2 min) ..."
    IP=$(dato PublicIpAddress)
    for i in $(seq 1 60); do
      if app_lista "$IP"; then
        verde ">> App lista (web + backend)."
        urls
        exit 0
      fi
      sleep 5
    done
    rojo ">> La instancia arranco pero la app no respondio en 5 minutos."
    echo ">> Revisa la consola de la instancia o entra por SSH con tu propia clave." >&2
    urls
    exit 1
    ;;
  apagar)
    if [ "$(dato State.Name)" = "stopped" ]; then
      echo ">> $ID ya estaba detenida."
    else
      echo ">> Apagando $ID (la app se detiene en orden con ella) ..."
      $AWS ec2 stop-instances --instance-ids "$ID" >/dev/null
      $AWS ec2 wait instance-stopped --instance-ids "$ID"
    fi
    verde ">> Detenida: deja de consumir horas de instancia."
    echo "   La Elastic IP sigue reservada para que el origen de CloudFront no cambie."
    echo "   Una IPv4 publica se factura igual, este asociada o no."
    ;;
  estado)
    $AWS ec2 describe-instances --instance-ids "$ID" \
      --query 'Reservations[0].Instances[0].{estado:State.Name,ip:PublicIpAddress,tipo:InstanceType,az:Placement.AvailabilityZone,lanzada:LaunchTime}' \
      --output table
    IP=$(dato PublicIpAddress)
    if [ "$IP" != "None" ] && app_lista "$IP"; then
      verde "La app esta respondiendo."
    else
      echo "La app no esta respondiendo."
    fi
    urls
    ;;
  *)
    echo "uso: $0 {encender|apagar|estado}" >&2
    exit 2
    ;;
esac
