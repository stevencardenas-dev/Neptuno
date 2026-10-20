# Despliegue en AWS EC2 (Podman)

Según el documento del proyecto, todos los microservicios corren como contenedores
Podman en **una sola instancia EC2**.

## 1. Crear la instancia (consola de AWS → EC2 → Launch instance)

| Campo | Valor |
|---|---|
| AMI | Ubuntu Server 24.04 LTS |
| Tipo | `m7i-flex.large` (2 vCPU, 8 GB). La cuenta del proyecto está en el **plan gratuito**, que rechaza cualquier tipo no elegible (`t3.medium` → `InvalidParameterCombination`). Elegibles: `m7i-flex.large`, `c7i-flex.large`, `t3.small`, `t3.micro`, `t4g.*`, `t8i.*`. `t3.small` (2 GB) no alcanza para el stack completo. |
| Disco | 20 GB gp3 |
| Key pair | crea uno y guarda el `.pem` |
| Security group | SSH (22) solo desde *My IP*; TCP **8080** desde `0.0.0.0/0` |

No abras 8081, 8082, 8083, 8084 ni 3306 ni 15672: el frontend (nginx) llega a los servicios por la red interna.

## 2. Desplegar

```bash
ssh -i neptuno.pem ubuntu@<IP-publica>
git clone <url-del-repo> neptuno && cd neptuno
./desplegar-ec2.sh
```

El script instala Podman, genera `.env` con secretos aleatorios (solo la primera vez)
y levanta el stack. La clave del administrador inicial queda en `.env` (`grep ADMIN_ .env`).

La primera compilación tarda varios minutos (Maven y npm). Los servicios pueden
reiniciarse un par de veces mientras MySQL arranca; es normal.

## 3. Verificar

- `http://<IP-publica>:8080` → pantalla de login; entra con el admin de `.env`.
- `podman ps` → todos los contenedores `Up`.
- Menú **Auditoría → Bitácora** → la franja debe decir «Íntegra» y «Ningún registro se ha alterado».
- Menú **Flujo de trabajo → Flujos** → crear un flujo y verlo en la tabla; el cambio aparece
  en la bitácora como «Flujo creado» (que es la prueba de que los tres servicios se hablan).
- En la misma tabla, el botón de la primera columna abre el **lienzo del flujo**: agregar
  pasos, conectarlos con una acción, asignar un responsable y publicar. Publicar un flujo
  incompleto debe devolver la lista de lo que falta; publicarlo completo lo deja «En
  operación» y el lienzo pasa a solo lectura. Archivar y reactivar están en la cabecera.
- Logs: `podman logs -f neptuno-usuarios`. Servicios en 8081 (usuarios), 8082 (documentos),
  8083 (auditoría) y 8084 (workflow).

## 4. Actualizar

```bash
cd neptuno && git pull && ./desplegar-ec2.sh
```

## Problemas de portabilidad (ya resueltos en el repo)

Tres diferencias entre Docker y Podman en Ubuntu 24.04 rompen el despliegue. Las tres
están corregidas; no hay que hacer nada a mano:

1. **Nombres cortos de imagen** (`mysql:8.4`, `node:24-alpine`). Ubuntu deja
   `/etc/containers/registries.conf` sin `unqualified-search-registries`, así que ni el
   `build` ni el `pull` los resuelven. `desplegar-ec2.sh` crea el drop-in
   `/etc/containers/registries.conf.d/00-neptuno-dockerio.conf`.
2. **El `resolver` de nginx.** `frontend/nginx.conf.template` fijaba `127.0.0.11`, el DNS
   de Docker; Podman usa `10.89.0.1`. El proxy quedaba mudo (499/502) y solo se servía la
   SPA. Ahora no se fija ninguno y nginx resuelve al arrancar leyendo el `/etc/resolv.conf`
   del contenedor, lo que vale para ambos motores.
3. **Contenedores viejos.** `podman-compose` 1.0.x recompone la imagen pero **no recrea el
   contenedor** si no cambió el hash del compose. Por eso el script usa `--force-recreate`:
   sin él, `git pull && ./desplegar-ec2.sh` seguiría corriendo el código anterior.
4. **Reiniciar un solo servicio.** Por lo del punto 2, nginx resuelve los nombres **una
   sola vez, al arrancar**. Si se reinicia un contenedor suelto
   (`podman restart neptuno-auditoria`) puede quedar con una IP nueva, y nginx seguirá
   llamando a la vieja: esa ruta responde `502` hasta que se reinicie también el frontend.
   Con `./desplegar-ec2.sh` no ocurre, porque recrea todos los contenedores.

## CDN con CloudFront (sin dominio)

CloudFront delante de la misma instancia. **No se compra dominio**: el plan gratuito
prohíbe registrar dominios (`AccessDeniedException: Free Tier accounts are not supported
for this service`), así que se usa el certificado y el subdominio por defecto de
CloudFront — HTTPS con candado y sin coste.

Antes de crear la distribución hace falta una **Elastic IP**: el origen de CloudFront debe
tener un nombre estable, y sin ella cada Stop/Start cambia el DNS de la instancia y la
distribución empieza a devolver 502.

| Ajuste | Valor | Por qué |
|---|---|---|
| Origen | DNS público de la instancia, puerto 8080, `http-only` | nginx escucha en 8080 |
| Comportamiento por defecto | `CachingDisabled` + `AllViewerExceptHostHeader` | la SPA y `/api/*` nunca se cachean |
| `/assets/*` | `CachingOptimized` | son ficheros con hash, inmutables: 1 año de caché |
| Protocolo del visor | `redirect-to-https` | `http://` → 301 a `https://` |
| Clase de precio | `PriceClass_All` | incluye los nodos de Sudamérica |

Comprobado en producción: los estáticos pasan de `x-cache: Miss` a `x-cache: Hit`, y la
API conserva el `cache-control: no-store` que le manda Spring.

Detalle conocido: los errores 4xx/5xx (p. ej. el `401` de `actuator`) heredan el
`ErrorCachingMinTTL` por defecto de CloudFront (10 s). Ponerlo a 0 en los comportamientos
lo elimina; requiere otra propagación de ~3 min, así que hazlo cuando nadie esté probando.

## Costo

`m7i-flex.large` figura como elegible para la capa gratuita del plan, así que mientras se
respete el límite del plan el consumo de horas no debería generar cargo. **Detén la
instancia** (Stop) cuando no se use. Con la Elastic IP asociada la dirección sobrevive al
Stop/Start, así que el enlace del CDN no se rompe; la Elastic IP no añade coste frente a la
IPv4 pública que ya se facturaba. CloudFront entra en su capa gratuita (1 TB/mes de salida).
