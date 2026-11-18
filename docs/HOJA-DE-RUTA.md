# Hoja de ruta · Neptuno

Este documento reemplaza al antiguo índice de mockups. El frontend ya no muestra
vistas con datos inventados: cada pantalla consume un microservicio real y las 85
historias del backlog están cubiertas. Lo que sigue es el registro de lo
implementado por servicio y las funcionalidades nuevas que se proponen.

> Las vistas prototipo eliminadas (radicación, bandeja, expediente, flujos,
> plantillas, bitácora, rendimiento) siguen en el historial de git, en el commit
> `53560f3`; las pantallas actuales se construyeron sobre esos datos reales.

## Estado actual

| Microservicio | Estado | HU cubiertas |
|---------------|--------|--------------|
| `servicio-usuarios` (ms-auth-catalogs) | Implementado | HU-001…HU-016, HU-022 |
| `servicio-documentos` (ms-document-management) | Implementado: radicación, anexos, expediente, plantillas y copias | HU-017…HU-042 |
| `servicio-auditoria` (ms-audit-infra) | Implementado: bitácora encadenada, respaldos, restauración, métricas y pruebas de carga | HU-043…HU-047, HU-081, HU-082, HU-084, HU-085 |
| `servicio-workflow` (ms-workflow-bpm) | Implementado: diseñador, trámites con bandeja filtrable y semáforo, grupos, firma y versionado | HU-048…HU-080, HU-083 |
| Frontend | Login, panel, usuarios, roles, parámetros, radicación, expediente, plantillas, copias, bandeja, flujos, grupos, bitácora y operación | Todas las historias del backlog |

Avance: **85 de 85 historias (100 %)**. Las funcionalidades propuestas de la sección 2
van aparte del backlog y no están comprometidas.

## 1. Backlog implementado, agrupado por microservicio

La distribución sigue `docs/Neptuno_Proyecto.docx` (4 microservicios, 85 HU). El
detalle por historia —microservicio, endpoint estimado, permiso y estado— está en
la hoja **Product Backlog** de `docs/Neptuno_Requerimientos_Backlog_Sprints.xlsx`,
y las tablas de cada historia, en
[`docs/esquema-base-datos.sql`](esquema-base-datos.sql).

Cada servicio tiene su propia base de datos, publica eventos de bitácora en
RabbitMQ (exchange `neptuno.eventos`) con el patrón outbox que ya usa
`servicio-usuarios`, y consulta el contexto de acceso del usuario por la API
interna `/api/usuarios/interno/**` (HU-014).

### ms-document-management — Radicación, anexos, expediente y plantillas (Node.js · Express)

Implementado en `servicio-documentos/`: las 26 historias de documentos (HU-017…HU-042).

| HU | Funcionalidad |
|----|---------------|
| HU-017 | Código de radicado único e inmutable `AAAAMMDD + X + CONSECUTIVO` (consecutivo por día y origen) |
| HU-018, HU-024 | Clasificación por origen; solo el rol Radicador registra Recibido (`radicados:radicar-recibido`) |
| HU-019, HU-021, HU-039, HU-040 | Metadatos obligatorios y extendidos, clase Original/Copia; edición sin tocar el código |
| HU-020, HU-023 | Detalle y listado filtrable de radicados |
| HU-025…HU-029 | Anexos (PDF, PNG, JPG, DOCX, XLSX) en MinIO, carga por lote, descarga y eliminación con constancia. Salvedades: el formato inválido responde 400 (el backlog dice 415), solo se valida la extensión y el tipo declarado —no el contenido— y la descarga se entrega por el propio servicio, no con URL prefirmada |
| HU-030…HU-034 | Carpetas por área, subcarpetas, árbol del expediente con visibilidad por rol o área, accesos heredables y documentos No radicables |
| HU-035…HU-038 | Plantillas DOCX con variables detectadas del documento, vínculo a orígenes Interno/Externo, render y PDF anexado al radicado |
| HU-041, HU-042 | Envío de copias a destinatarios y bandeja de copias recibidas con marca de lectura |

### ms-workflow-bpm — Diseñador de flujos, bandeja y firma (Node.js · NestJS)

Implementado en `servicio-workflow/`: las 33 historias de flujo de trabajo (HU-048…HU-080)
y la consulta desde el celular (HU-083) — identidad del flujo, lienzo de pasos,
transiciones y responsables, grupos de trabajo, validación y publicación, trámites sobre
radicados con bandeja filtrable y semáforo, toma exclusiva y liberación, recorrido con
observaciones, firma electrónica y versionado explícito — con su propia base
`workflow_bpm_db` y sus pantallas "Flujos", "Diseñar flujo", "Bandeja" y "Grupos". La
definición vive en la versión del flujo, no en el flujo: un flujo en borrador se edita, y
al publicarlo su recorrido queda bloqueado para que los trámites en curso no cambien de
camino.

| HU | Funcionalidad |
|----|---------------|
| HU-048, HU-049, HU-051 | Crear, listar, consultar y editar el flujo (implementado) |
| HU-050 | Archivar el flujo y devolverlo a la operación (implementado) |
| HU-052…HU-055 | Lienzo de pasos: consultarlo, agregar, corregir, marcar inicial/intermedio/final y ubicarlo (implementado) |
| HU-056…HU-058 | Transiciones: crear la acción que lleva de un paso a otro, corregirla y eliminarla (implementado) |
| HU-059, HU-060 | Responsables por paso (usuario, rol o área validados contra ms-auth-catalogs) (implementado) |
| HU-061 | Validación y publicación: paso inicial, pasos finales y ningún paso aislado (implementado) |
| HU-062, HU-063, HU-066…HU-068 | Bandeja de tareas: iniciar trámite, ver la bandeja por responsable, aprobar, enviar, cancelar y devolver con observación |
| HU-064 | Filtrar y ordenar la bandeja por fecha, tipo documental, origen, vencimiento y orden |
| HU-065 | Abrir la tarea con metadatos y anexos del documento |
| HU-069 | Responsable por paso: usuario, área, rol o grupo de trabajo, validados contra ms-auth-catalogs |
| HU-070 | Tomar la tarea en exclusiva (409 si otro ya la tomó) y liberarla para otro responsable |
| HU-071 | Tenencia única del Original: una sola persona atiende la tarea tomada |
| HU-072…HU-074 | Tiempo límite del flujo y de cada paso; la bandeja calcula el semáforo de vencimiento al consultar |
| HU-075…HU-077 | Estados que exigen firma, firma electrónica (con SHA-256 del documento) y consulta de firmas |
| HU-078…HU-080 | Versionado: los trámites en curso conservan su versión y el historial de versiones es explícito |
| HU-083 | Consulta y aprobación desde el celular: diseño adaptable y botones de acción con tamaño táctil |

### ms-audit-infra — Bitácora y requerimientos no funcionales (Go)

Implementado en `servicio-auditoria/`: HU-043…HU-047, sobre la misma cola que ya
alimentaban los otros servicios, y los requerimientos no funcionales (HU-081, HU-082,
HU-084, HU-085).

| HU | Funcionalidad |
|----|---------------|
| HU-043…HU-047 | Consumidor de la cola `audit.infrastructure`; bitácora inalterable encadenada por hash, historial por documento y filtros |
| HU-081, HU-082 | Copias de seguridad programadas con `mysqldump` y retención por días; restauración que pide motivo y confirma otra persona |
| HU-084, HU-085 | Percentiles p50/p95/p99 medidos por el propio servicio y pruebas de carga con el generador `cmd/carga`, frente al límite de 2 s |

Salvedades: la copia cubre las bases del servidor MySQL configurado (cada servicio tiene
el suyo) y no los objetos de MinIO, que se respaldan con la herramienta del
almacenamiento; el generador de carga es un cliente HTTP en Go, no k6 ni JMeter.

### Uso desde el celular (HU-083)

El diseño ya era adaptable; ahora los filtros de la bandeja, el árbol del expediente y los
formularios de plantillas y grupos también lo son, los campos suben a 16 px en pantalla
estrecha (para que iOS no haga zoom al enfocar) y los modales ocupan el ancho completo con
botones de 40 px de alto.

## 2. Funcionalidades nuevas propuestas

Fuera del backlog original, priorizadas por valor frente a esfuerzo.

### Seguridad y cuenta

1. **Recuperación de contraseña por correo** — token de un solo uso con
   vencimiento corto; el login tenía un enlace "¿Olvidaste tu contraseña?" que no
   hacía nada y se retiró hasta que exista.
2. **Cambio de contraseña por el propio usuario** y **cambio obligatorio en el
   primer ingreso** (hoy solo el administrador puede cambiarla).
3. **Política de contraseñas** configurable (longitud, complejidad, historial).
4. **Cierre de todas las sesiones** de un usuario al cambiar su contraseña: hoy
   el refresco emitido antes sigue siendo válido hasta que vence (12 h).
5. **Tokens en cookie `HttpOnly` + `SameSite=Strict`** en lugar de
   `localStorage`, para que un XSS no pueda robar la sesión.
6. **Segundo factor (TOTP)** para los roles Administrador y Firmante.
7. **Limitación de tasa** en `/auth/login` por IP (además del bloqueo por cuenta).

### Experiencia de usuario

8. **Búsqueda global** en la barra superior (radicados, usuarios, expedientes):
   la barra existía pero no buscaba nada y se retiró.
9. **Centro de notificaciones** (ms-notificaciones): tareas asignadas, vencimientos
   del semáforo y copias recibidas, por WebSocket y correo. La campana del encabezado
   se retiró porque mostraba un punto rojo fijo.
10. **Perfil del usuario**: datos, foto, preferencias y sesiones activas.
11. **Exportar listados** (usuarios, radicados, bitácora) a CSV/XLSX.
12. **Importación masiva** de usuarios y entidades desde CSV.
13. **Diseño responsive para aprobar desde el celular** (HU-083) y PWA instalable.

### Operación y calidad

14. **API gateway** (Spring Cloud Gateway) que valide el JWT una sola vez y
    aplique límites de tasa, en lugar de que nginx solo reparta rutas.
15. **Trazas distribuidas** (OpenTelemetry) y `X-Correlation-Id` en los eventos.
16. **Pruebas del frontend** (Vitest + Testing Library) y **ESLint**.
17. **Pruebas de integración contra MySQL real** con Testcontainers (hoy se usa
    H2, que no detecta diferencias de dialecto).
18. **Dashboard del panel con indicadores reales** del negocio cuando existan
    ms-document-management y ms-workflow-bpm (radicados por área, tareas vencidas, tiempos).
19. **Retención documental (TRD)**: tiempos de conservación por tipo documental y
    disposición final, requisito habitual en entidades públicas colombianas.
