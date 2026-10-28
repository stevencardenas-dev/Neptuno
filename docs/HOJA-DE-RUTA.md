# Hoja de ruta · Neptuno

Este documento reemplaza al antiguo índice de mockups. El frontend ya no muestra
vistas con datos inventados: cada pantalla que existe consume un microservicio
real. Lo que sigue es el plan para el resto del backlog (85 historias de
usuario) y las funcionalidades nuevas que se proponen.

> Las vistas prototipo eliminadas (radicación, bandeja, expediente, flujos,
> plantillas, bitácora, rendimiento) siguen en el historial de git, en el commit
> `53560f3`, por si se quiere reutilizar su maquetación al implementarlas.

## Estado actual

| Microservicio | Estado | HU cubiertas |
|---------------|--------|--------------|
| `servicio-usuarios` (ms-auth-catalogs) | Implementado | HU-001…HU-016, HU-022 |
| `servicio-documentos` (ms-document-management) | En curso: radicación (crear, consultar, listar, editar) y anexos en MinIO | HU-017…HU-021, HU-023…HU-026, HU-028, HU-029, HU-039, HU-040 |
| `servicio-auditoria` (ms-audit-infra) | Implementado: bitácora encadenada por hash, consulta, historial por documento y filtros | HU-043…HU-047 |
| `servicio-workflow` (ms-workflow-bpm) | En curso: diseñador de flujos y trámites con bandeja de entrada | HU-048…HU-063, HU-066…HU-068, HU-071 |
| Frontend | Login, panel, usuarios, roles, parámetros, radicación con anexos, bandeja, flujos (lista y lienzo) y bitácora | Las de usuarios, radicación, flujos y auditoría |

Avance: **55 de 85 historias (65 %)**. De las 30 que faltan, 12 son de documentos
(carpetas y expediente, plantillas, copias y la carga de varios anexos a la vez), 14 de
flujo de trabajo (los tiempos límite y el semáforo, filtros de la bandeja, liberar una
tarea, grupos como responsables, firma electrónica, versionado explícito y móvil) y 4 de
auditoría (copias de seguridad, métricas y pruebas de carga). El conteo no pesa todas las historias igual —un formulario no cuesta lo mismo
que el lienzo de pasos y transiciones— y las funcionalidades propuestas de la sección 2
van aparte de las 85.

## 1. Backlog pendiente, agrupado por microservicio

La distribución sigue `docs/Neptuno_Proyecto.docx` (4 microservicios, 85 HU). El
detalle por historia —microservicio, endpoint estimado, permiso y estado— está en
la hoja **Product Backlog** de `docs/Neptuno_Requerimientos_Backlog_Sprints.xlsx`,
y las tablas que necesitan las historias pendientes, en
[`docs/esquema-base-datos.sql`](esquema-base-datos.sql).

Cada servicio tiene su propia base de datos, publica eventos de bitácora en
RabbitMQ (exchange `neptuno.eventos`) con el patrón outbox que ya usa
`servicio-usuarios`, y consulta el contexto de acceso del usuario por la API
interna `/api/usuarios/interno/**` (HU-014).

### ms-document-management — Radicación, anexos, expediente y plantillas (Node.js · Express)

Implementado en `servicio-documentos/`: HU-017…HU-021, HU-023…HU-026, HU-028, HU-029, HU-039 y
HU-040 (radicación y anexos en MinIO). Falta el expediente y las plantillas (carpetas,
subcarpetas, documentos No radicables, plantillas DOCX y copias a destinatarios) y la carga de
varios anexos en una sola petición (HU-027: hoy se sube un archivo por petición).

| HU | Funcionalidad |
|----|---------------|
| HU-017 | Código de radicado único e inmutable `AAAAMMDD + X + CONSECUTIVO` (consecutivo por día y origen) |
| HU-018, HU-024 | Clasificación por origen; solo el rol Radicador registra Recibido (`radicados:radicar-recibido`) |
| HU-019, HU-021, HU-039, HU-040 | Metadatos obligatorios y extendidos, clase Original/Copia; edición sin tocar el código |
| HU-020, HU-023 | Detalle y listado filtrable de radicados |
| HU-025, HU-026, HU-028, HU-029 | Anexos (PDF, PNG, JPG, DOCX, XLSX) en MinIO, descarga y eliminación con constancia (implementado). Salvedades: el formato inválido responde 400 (el backlog dice 415), solo se valida la extensión y el tipo declarado —no el contenido— y la descarga se entrega por el propio servicio, no con URL prefirmada |
| HU-027 | Varios archivos en una sola carga (pendiente) |
| HU-030…HU-034 | Carpetas por área, subcarpetas, árbol del expediente, visibilidad por rol y documentos No radicables |
| HU-035…HU-038 | Plantillas DOCX con variables, vínculo a orígenes Interno/Externo, render y PDF |
| HU-041, HU-042 | Envío de copias a destinatarios y bandeja de copias recibidas |

### ms-workflow-bpm — Diseñador de flujos, bandeja y firma (Node.js · NestJS)

Implementado en `servicio-workflow/`: HU-048…HU-063, HU-066…HU-068 y HU-071 — la identidad del flujo (crear, listar,
consultar y editar), el lienzo de pasos, transiciones y responsables, la validación de
publicación y el archivo del flujo, más los trámites sobre radicados con bandeja de entrada,
toma exclusiva y recorrido con observaciones — con su propia base `workflow_bpm_db` y sus
pantallas "Flujos", "Diseñar flujo" y "Bandeja". La definición vive en la versión del flujo,
no en el flujo: un flujo en borrador se edita, y al publicarlo su recorrido queda bloqueado
para que los trámites en curso no cambien de camino.

| HU | Funcionalidad |
|----|---------------|
| HU-048, HU-049, HU-051 | Crear, listar, consultar y editar el flujo (implementado) |
| HU-050 | Archivar el flujo y devolverlo a la operación (implementado) |
| HU-052…HU-055 | Lienzo de pasos: consultarlo, agregar, corregir, marcar inicial/intermedio/final y ubicarlo (implementado) |
| HU-056…HU-058 | Transiciones: crear la acción que lleva de un paso a otro, corregirla y eliminarla (implementado) |
| HU-059, HU-060 | Responsables por paso (usuario, rol o área validados contra ms-auth-catalogs) (implementado) |
| HU-061 | Validación y publicación: paso inicial, pasos finales y ningún paso aislado (implementado) |
| HU-062, HU-063, HU-066…HU-068 | Bandeja de tareas: iniciar trámite, ver la bandeja por responsable, aprobar, enviar, cancelar y devolver con observación (implementado) |
| HU-064 | Filtrar y ordenar la bandeja por fecha, tipo documental y origen (pendiente: hoy solo se ordena por vencimiento) |
| HU-065 | Abrir la tarea con metadatos y anexos del documento (parcial: muestra los metadatos y el recorrido, pero no los anexos) |
| HU-069 | Responsable por paso: usuario, área o rol validados contra ms-auth-catalogs (implementado); grupos de trabajo pendientes porque no hay catálogo de grupos |
| HU-070 | Tomar la tarea de forma exclusiva con 409 si otro ya la tomó (implementado); `liberar` pendiente |
| HU-071 | Tenencia única del Original: una sola persona atiende la tarea tomada (implementado) |
| HU-072…HU-074 | Tiempo límite del flujo y de cada paso, y semáforo de vencimiento (pendiente: las columnas existen, pero ningún endpoint las configura, así que la bandeja siempre dice «Sin plazo») |
| HU-075…HU-077 | Estados que exigen firma, firma electrónica y consulta de firmas |
| HU-078…HU-080 | Versionado: los trámites en curso conservan su versión |
| HU-083 | Consulta y aprobación desde el celular |

### ms-audit-infra — Bitácora y requerimientos no funcionales (Go)

Implementado en `servicio-auditoria/`: HU-043…HU-047, sobre la misma cola que ya
alimentaban los otros dos servicios. Falta lo no funcional (copias de seguridad,
métricas y pruebas de carga).

| HU | Funcionalidad |
|----|---------------|
| HU-043…HU-047 | Consumidor de la cola `audit.infrastructure`; bitácora inalterable encadenada por hash, historial por documento y filtros |
| HU-081, HU-082 | Copias de seguridad programadas y restauración |
| HU-084, HU-085 | Métricas de tiempos de respuesta y pruebas de carga con el límite de 2 s |

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
