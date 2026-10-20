# Nota técnica · Peso real de cada microservicio

**Asunto:** cuánto ocupa y cuánto consume cada servicio, medido en la instancia desplegada
**Fecha:** 17 de octubre de 2026 · Avance 2
**Fuente:** `podman stats --no-stream` y `podman images` sobre la instancia, en reposo (sin
tráfico), con el stack completo arriba: 10 contenedores.

---

## 1. Los números

Antes de crecer el backlog conviene saber qué cuesta cada pieza. Todo lo de abajo está
medido, no estimado.

| Componente | Lenguaje / base | Líneas | Imagen | Memoria en reposo |
|---|---|---:|---:|---:|
| `servicio-usuarios` (ms-auth-catalogs) | Java 21 · Spring Boot | 5 467 | 279 MB | 305 MB |
| `servicio-documentos` (ms-document-management) | Node 24 · Express | 1 210 | 191 MB | 26.5 MB |
| `servicio-auditoria` (ms-audit-infra) | Go 1.27 · net/http | 1 952 | **16.4 MB** | **3.9 MB** |
| `servicio-workflow` (ms-workflow-bpm) | Node 24 · NestJS | 2 431 | 202 MB | 39.4 MB |
| `frontend` | React 19 · Vite · nginx | 5 651 | 70.9 MB | 3 MB |
| `db-usuarios`, `db-documentos`, `db-auditoria`, `db-workflow` | MySQL 8.4 ×4 | — | 829 MB (compartida) | 1 809 MB |
| `rabbitmq` | RabbitMQ 4 · alpine | — | 178 MB | 61.6 MB |
| **Total** | | **16 711** | | **≈ 2.25 GB de 7.8 GB (29 %)** |

El conteo de líneas es el de las fuentes y pruebas de cada servicio, sin dependencias ni
artefactos compilados. Disco de la instancia: 5.8 GB usados de 19 GB (32 %). Carga en reposo:
0.07 sobre 2 vCPU.

## 2. Lo que dicen los números

1. **El peso está en las bases, no en los servicios.** Los cuatro MySQL se llevan 1 809 MB
   de los 2 248 MB en uso (80 %). Los cuatro microservicios y el frontend juntos suman
   378 MB. Si algún día hay que apretar la instancia, el recorte está en la estrategia de
   base de datos por servicio, no en los servicios.
2. **El lenguaje sí cambia la factura, y mucho.** El servicio de bitácora, escrito en Go y
   con binario estático, ocupa 16 MB de imagen y 3.9 MB de memoria: pesa menos que el
   frontend del login. Es el argumento más fuerte para escribir en Go los servicios que
   sean intensivos en tráfico y de lógica sencilla.
3. **NestJS frente a Express pesa un 6 % más de imagen** (202 MB contra 191 MB), con el
   mismo runtime de Node detrás. En memoria, el diseñador de flujos lo llevó de 31 a 39 MB
   frente a los 26 MB del servicio de documentos: son 13 MB más (medio punto de la máquina)
   y vienen del código cargado —esquemas de validación, cliente de catálogos, seis
   controladores—, no del framework. Lo que sí agrega NestJS es complejidad de proyecto
   (compilador propio, dos `tsconfig`, arnés de pruebas).
4. **El respaldo es que quede memoria libre.** Con 10 contenedores quedan ~5.5 GB disponibles
   y la máquina está ociosa, así que el backlog pendiente —20 historias de flujo de
   trabajo, 16 de documentos, 4 de auditoría— no debería chocar con este techo: crece en
   tablas y filas, no en contenedores.
5. **El costo real sigue en $0.** La instancia se enciende por eventos (miércoles 9:00 a
   15:00) y en reposo consume crédito igual que apagada, que es lo que ya muestra el
   presupuesto del proyecto.

## 3. Lo que falta y cuánto pesaría

Esta parte **no está medida en la instancia**: son estimaciones para decidir si el bloque de
anexos entra en el mismo servidor o pide uno aparte.

| Bloque pendiente | HU | Peso estimado | Por qué |
|---|---|---|---|
| Anexos y documentos no radicables | HU-025…HU-029, HU-034 | ~900 líneas · +1 contenedor (MinIO, ≈ 150 MB de imagen y ≈ 200 MB de memoria) o S3 | El archivo de los PDF y oficios no entra en MySQL; hoy esos 5 endpoints quedan sin servicio porque no hay dónde dejarlos |
| Carpetas y expediente | HU-030…HU-033 | ~500 líneas · 0 contenedores (tablas en `document_management_db`) | Es modelo de datos y permisos por rol; no agrega peso de infraestructura |
| Bandeja, SLA y firma | HU-062…HU-077 | ~1 800 líneas · 0 contenedores | Vive en el servicio de flujo que ya está arriba |
| Copias de seguridad y métricas | HU-081, HU-082, HU-084, HU-085 | ~400 líneas · +1 contenedor (`mysqldump` no; un trabajo programado) | Se resuelve con un `podman exec` programado y un endpoint de métricas en Go |
| **Total pendiente** | 40 HU | ≈ +3 600 líneas · a lo sumo +1 contenedor | La máquina tiene 5.5 GB libres: el anexo de MinIO entra sin cambiar de instancia |

## 4. Cómo volver a medirlo

```bash
ssh -i neptuno.pem ubuntu@18.219.151.58
podman stats --no-stream --format '{{.Name}}\t{{.MemUsage}}'
podman images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}'
df -h /            # disco
free -m            # memoria total frente a la suma de los topes
```

Los topes de memoria de cada contenedor están en `docker-compose.yml` (`mem_limit`) y son
deliberadamente holgados respecto a lo medido, para que un pico de una petición no reinicie
un servicio.
