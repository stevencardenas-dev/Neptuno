#!/usr/bin/env bash
# Despliega Neptuno en una instancia EC2 (Ubuntu 24.04) con Podman.
# Se ejecuta DENTRO de la instancia, desde la raíz del repo clonado:
#   ./desplegar-ec2.sh
# Es idempotente: volver a correrlo tras un `git pull` reconstruye y reinicia.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v podman-compose >/dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y podman podman-compose openssl
fi

# Ubuntu 24.04 deja /etc/containers/registries.conf sin registros de busqueda, de modo
# que los nombres cortos (mysql:8.4, node:20-alpine) no resuelven ni en build ni en pull.
if ! grep -rqs 'unqualified-search-registries' /etc/containers/registries.conf.d/ 2>/dev/null; then
  echo 'unqualified-search-registries = ["docker.io"]' \
    | sudo tee /etc/containers/registries.conf.d/00-neptuno-dockerio.conf >/dev/null
fi

# ponytail: podman-compose 1.0.x ignora `condition: service_healthy`; los
# servicios arrancan antes que MySQL y se recuperan con `restart: unless-stopped`.

if [ ! -f .env ]; then
  gen() { openssl rand -base64 "$1" | tr -d '/+=\n'; }
  sed -e "s|^DB_CLAVE=.*|DB_CLAVE=$(gen 24)|" \
      -e "s|^DB_CLAVE_ROOT=.*|DB_CLAVE_ROOT=$(gen 24)|" \
      -e "s|^RABBIT_CLAVE=.*|RABBIT_CLAVE=$(gen 24)|" \
      -e "s|^JWT_SECRETO=.*|JWT_SECRETO=$(gen 48)|" \
      -e "s|^CLAVE_SERVICIOS=.*|CLAVE_SERVICIOS=$(gen 32)|" \
      -e "s|^MINIO_CLAVE=.*|MINIO_CLAVE=$(gen 24)|" \
      -e "s|^ADMIN_CLAVE=.*|ADMIN_CLAVE=Nep*$(gen 12)|" \
      .env.example > .env
  chmod 600 .env
  echo ">> .env generado con secretos aleatorios. Clave del admin: grep ADMIN_ .env"
fi

# Las claves de MinIO se añadieron después de que las instancias ya tenían su .env:
# se completan solo si faltan, sin tocar los secretos existentes.
if ! grep -qE '^MINIO_CLAVE=.+' .env; then
  nuevo=$(openssl rand -base64 24 | tr -d '/+=\n')
  printf 'MINIO_USUARIO=neptuno\nMINIO_CLAVE=%s\nMINIO_BUCKET=neptuno-anexos\n' "$nuevo" >> .env
  echo ">> .env completado con las claves de MinIO."
fi

# --force-recreate: podman-compose 1.0.x recompone la imagen pero NO recrea el
# contenedor si el hash del compose no cambió, así que tras un `git pull` (o al
# cambiar un Dockerfile/plantilla) seguirían corriendo los contenedores viejos.
podman-compose up -d --build --force-recreate

# Unidad de usuario para que el stack vuelva solo tras un Stop/Start de la instancia.
# No vale habilitar podman-restart.service: solo arranca contenedores con politica
# `always`, y aqui se usa `unless-stopped`, que es mas amable al desarrollar en local
# (un contenedor que paras a proposito se queda parado).
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/neptuno.service" <<UNIT
[Unit]
Description=Neptuno (podman-compose)
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PWD
ExecStart=/usr/bin/podman-compose up -d
ExecStop=/usr/bin/podman-compose down

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable neptuno.service >/dev/null
sudo loginctl enable-linger "$(id -un)" >/dev/null
echo ">> arranque automatico habilitado: neptuno.service"

podman ps --format '{{.Names}}\t{{.Status}}'
echo ">> Frontend: http://$(curl -s --max-time 2 http://checkip.amazonaws.com || echo '<IP-publica>'):8080"
