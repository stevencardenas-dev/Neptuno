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
| Frontend | Login, panel, usuarios, roles, parámetros | Las mismas |

## 1. Backlog pendiente, agrupado por microservicio

Cada servicio tiene su propia base de datos, publica eventos de bitácora en
RabbitMQ (exchange `neptuno.eventos`) con el patrón outbox que ya usa
`servicio-usuarios`, y consulta el contexto de acceso del usuario por la API
interna `/api/usuarios/interno/**` (HU-014).

### ms-radicacion — Radicación y anexos

| HU | Funcionalidad |
|----|---------------|
| HU-017 | Código de radicado único e inmutable `AAAAMMDD + X + CONSECUTIVO` (consecutivo por día y origen con bloqueo optimista o secuencia en BD) |
| HU-018, HU-024 | Clasificación por origen; solo el rol Radicador registra Recibido (`radicados:radicar-recibido`) |
| HU-019, HU-021, HU-039, HU-040 | Metadatos obligatorios y extendidos, clase Original/Copia; edición sin tocar el código |
| HU-020, HU-023 | Detalle y listado filtrable de radicados |
| HU-025…HU-029 | Anexos múltiples (PDF, PNG, JPG, DOCX, XLSX) en almacenamiento de objetos (MinIO/S3), descarga y eliminación con constancia |
| HU-041, HU-042 | Envío de copias a destinatarios y bandeja de copias recibidas |

### ms-expediente — Archivo institucional

| HU | Funcionalidad |
|----|---------------|
| HU-030…HU-032 | Carpetas por área, subcarpetas temáticas y vista de árbol |
| HU-033, HU-014 | Visibilidad de carpetas y documentos según rol y área |
| HU-034 | Documentos No radicables en subcarpetas con consecutivo propio |

### ms-flujos — Diseñador y motor de workflow

| HU | Funcionalidad |
|----|---------------|
| HU-048…HU-061 | CRUD de flujos, lienzo de estados y transiciones, validación y publicación |
| HU-069, HU-059, HU-060 | Responsable por nodo: persona, grupo, rol o área |
| HU-072, HU-073, HU-074 | Tiempos máximos por trámite y por nodo; semáforo verde/amarillo/rojo |
| HU-078…HU-080 | Versionado: los documentos en tránsito conservan su versión |
| HU-062…HU-068, HU-070, HU-071 | Bandeja de tareas: tomar, aprobar, rechazar y devolver con observación; asignación exclusiva |
| HU-075, HU-076 | Estados que exigen firma y aplicación de firma electrónica |

### ms-plantillas — Generación de documentos

| HU | Funcionalidad |
|----|---------------|
| HU-035…HU-038 | Plantillas DOCX con variables, vínculo a orígenes Interno/Externo, render y conversión a PDF |

### ms-audit-infra — Bitácora, respaldos y rendimiento

| HU | Funcionalidad |
|----|---------------|
| HU-043…HU-047, HU-077 | Consumidor de la cola `audit.infrastructure`; bitácora inmutable (append-only, encadenada por hash), filtros y firmas |
| HU-081, HU-082 | Copias de seguridad programadas y restauración |
| HU-084, HU-085 | Métricas (Micrometer + Prometheus) y pruebas de carga (k6/Gatling) con el límite de 2 s |

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
    ms-radicacion y ms-flujos (radicados por área, tareas vencidas, tiempos).
19. **Retención documental (TRD)**: tiempos de conservación por tipo documental y
    disposición final, requisito habitual en entidades públicas colombianas.
