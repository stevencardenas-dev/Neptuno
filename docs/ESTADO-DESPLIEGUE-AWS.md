# Estado del despliegue en AWS

Cómo está desplegado Neptuno hoy y con qué garantías. Los datos son de la
ejecución real, medidos sobre la instancia en marcha.

El detalle del por qué se puede desplegar sin tarjeta de crédito y a costo cero está
en [`DESPLIEGUE-SIN-TARJETA.md`](DESPLIEGUE-SIN-TARJETA.md); el manual operativo
está en [`DESPLIEGUE.md`](DESPLIEGUE.md).

## 1. Infraestructura

| Elemento | Detalle |
|---|---|
| Cuenta | Plan gratuito de AWS, **sin tarjeta**: el plan rechaza de plano cualquier recurso fuera de lo elegible, así que el costo es **USD $0** |
| Instancia | Una sola EC2 (`m7i-flex.large`, 2 vCPU, 8 GB, 20 GB gp3) en `us-east-2` |
| Contenedores | 10 (frontend + 4 microservicios + 4 MySQL + RabbitMQ) con Podman |
| Red | Privada de contenedores; solo el frontend publica un puerto al exterior |
| Publicación | **CloudFront** con HTTPS y una **IP elástica** en la instancia: la dirección no cambia al apagar y encender |
| Créditos | USD $120 disponibles, **gasto acumulado $0** |

Los servicios internos (8081, 8082, 8083, 8084 y 15672) escuchan en
`127.0.0.1`: el exterior solo ve el puerto 8080, y el tráfico entre servicios va
por la red interna de Podman.

## 2. Encender y apagar

El consumo de horas de máquina es el único costo real, así que la instancia se
enciende solo cuando hace falta:

- `./controlar-ec2.sh encender` — levanta la instancia y espera a que la app
  responda. **La app se levanta sola** (una unidad de systemd arranca los
  contenedores al iniciar la máquina): **44 s** en frío.
- `./controlar-ec2.sh apagar` — detiene la app en orden (la base de datos cierra
  sin perder datos) y luego la instancia: **37 s**.
- `./controlar-ec2.sh estado` — si la app está respondiendo y dónde entrar.

Hay además un botón en GitHub (pestaña **Actions → Encender / apagar la app**)
para encenderla o apagarla sin instalar nada ni tener cuenta de AWS.

## 3. Controles aplicados

- Los **secretos** (claves de base de datos, clave JWT, clave entre servicios) se
  generan al azar en el momento del desplegar, viven en un `.env` de la instancia
  con permisos restringidos y **no se versionan nunca**.
- **Autenticación con JWT** y control de acceso por roles; los permisos se siembran
  idempotentemente y el rol Administrador es el único que los concentra.
- **Límites de memoria** por contenedor, para que un servicio no acapare la máquina.
- **SSH solo desde la IP del administrador**; el grupo de seguridad no expone las
  bases de datos ni el broker.
- La cuenta está en una **organización con SCP**: los límites valen para todos los
  usuarios, incluidos los del equipo, y no se pueden relajar desde la cuenta.
- Cada hecho de auditoría queda **encadenado por su huella**; la integridad de la
  cadena se comprueba desde la propia pantalla de bitácora.

## 4. Flujo de despliegue

`desplegar-ec2.sh` se ejecuta dentro de la instancia y es idempotente: volver a
correrlo tras un `git pull` reconstruye y reinicia el sistema con los últimos
cambios, incluida la migración de la base de datos.

Además, el despliegue es **continuo**: cuando las pruebas del CI pasan en `main`,
un flujo de trabajo reconstruye la instancia por AWS Systems Manager y verifica
que la app vuelve a responder.
