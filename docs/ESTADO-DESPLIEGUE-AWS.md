# Estado real del despliegue · AWS

Este documento acompaña a `INFORME-DESPLIEGUE-AWS.pdf` (el informe entregado al
Product Owner el 16 de octubre). **El PDF se conserva tal como se entregó**: es el
plan y sus supuestos, no el estado actual. Esta nota dice qué quedó abierto en
aquel plan y cómo se resolvió, para que nadie lo lea como si el sistema siguiera
sin desplegar.

El detalle completo de la ejecución está en
[`DESPLIEGUE-SIN-TARJETA.md`](DESPLIEGUE-SIN-TARJETA.md).

## 1. Lo que el informe dejó abierto

| Punto abierto en el informe (16 de octubre) | Cómo quedó |
|---|---|
| "Confirmar la disponibilidad de `t3.medium`" | El plan **gratuito rechaza** `t3.medium` (`InvalidParameterCombination`). La instancia que corre es **`m7i-flex.large`** (2 vCPU, 8 GB, 20 GB gp3) |
| "Costo estimado ≈ USD 30 al mes" | El costo real es **USD $0**: la cuenta **no tiene tarjeta** (plan gratuito, que rechaza de plano cualquier recurso fuera del plan). Los créditos (**USD $120**) nunca se han gastado y el gasto acumulado es **$0** |
| "El sistema aún no ha sido publicado" | **Publicado el 21 de octubre** y funcionando: https://d191zzy2qixa5q.cloudfront.net/ |
| "El acceso público es por HTTP, sin cifrado" | Sigue siendo HTTP **en el origen**, pero el usuario entra por **HTTPS con CloudFront** (sin dominio propio y sin costo) |
| "La IP pública cambia cada vez que se detiene" | Se le asignó una **IP elástica**: la dirección no cambia al apagar y encender |
| "El script de despliegue aún no está incluido en el control de versiones" | `desplegar-ec2.sh` está en el repositorio, y además el despliegue es **continuo**: cuando el CI pasa en `main`, un flujo de trabajo reconstruye y reinicia la instancia por AWS Systems Manager |

## 2. Lo que el informe propuso y sí quedó como está

- El **puerto 8080** es el único accesible desde Internet; 8081, 8082, 8083, 8084 y
  15672 quedan en la interfaz local de la instancia.
- Los **secretos se generan al azar** al desplegar, viven en el `.env` de la
  instancia con permisos restringidos y **nunca se versionan**.
- Autenticación con **JWT** y control de acceso por **roles**.
- Límites de memoria por contenedor, para que un servicio no acapare la máquina.

## 3. Lo que se añadió después

- **Apagado y encendido sin costo**: `controlar-ec2.sh` y un botón en GitHub
  (Actions → *Encender / apagar la app*) para que el equipo no necesite cuenta de
  AWS ni instalar nada. Apagar: **37 s**. Encender: **44 s** (la app levanta sola,
  con la unidad `neptuno.service`).
- **Auditoría encadenada por hash** (`servicio-auditoria`, Go): cada hecho se
  encadena con su huella, y la comprobación de integridad es parte de la página.
- **Diseñador de flujos** (`servicio-workflow`, NestJS) con versión del flujo,
  pasos, transiciones, responsables y publicación.
- Aislamiento por **SCP de la organización**, permisos por persona y registro en
  CloudTrail.
