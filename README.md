# Neptuno · Sistema de Gestión Documental

Repositorio monorepo que sigue una metodología de **microservicios**, con un
frontend y un servicio por dominio. La identidad visual del sistema usa la
paleta institucional **azul, rojo y blanco**.

> **Estado actual:** implementados los cuatro servicios del proyecto y desplegados
> en AWS: `servicio-usuarios/` (Java 21 + Spring Boot), `servicio-documentos/`
> (Node 24 + Express), `servicio-auditoria/` (Go) y `servicio-workflow/`
> (Node 24 + NestJS), más el `frontend/`. Todas las vistas consumen microservicios
> reales; no hay datos de ejemplo. El avance del backlog (45 de 85 historias) y lo
> que falta está en [`docs/HOJA-DE-RUTA.md`](docs/HOJA-DE-RUTA.md).

## Estructura del proyecto

```
Neptuno/
├── frontend/                 # SPA (Vite + React) servida por nginx
├── servicio-usuarios/        # ms-auth-catalogs: Java 21 + Spring Boot (HU-001…HU-016, HU-022)
├── servicio-documentos/      # ms-document-management: Node 24 + Express (radicación, en curso)
├── docs/
│   ├── Neptuno_Proyecto.docx                       # documento del proyecto (arquitectura y 85 HU)
│   ├── Neptuno_Requerimientos_Backlog_Sprints.xlsx # requerimientos, backlog con microservicio y endpoint por HU, sprints
│   ├── esquema-base-datos.sql                      # tablas de las HU pendientes (3 bases MySQL)
│   ├── MATRIZ-API-HU.md      # trazabilidad endpoint ↔ historia de usuario (servicio implementado)
│   ├── HOJA-DE-RUTA.md       # próximos microservicios y funcionalidades propuestas
│   ├── DESPLIEGUE-SIN-TARJETA.md # cómo se desplegó sin tarjeta y con costo 0 (documento del PO)
│   ├── DESPLIEGUE.md         # manual de despliegue en EC2 (equipo)
│   └── NOTA-TECNICA-*.md     # decisiones de diseño y mediciones del avance
├── .github/workflows/ci.yml  # pruebas del backend y build del frontend en cada PR
├── docker-compose.yml        # frontend + servicios + MySQL + RabbitMQ
├── controlar-ec2.sh          # encender y apagar la app en AWS (equipo)
├── desplegar-ec2.sh          # despliegue en la instancia (se ejecuta dentro de ella)
└── .env.example              # plantilla de secretos para docker compose
```

## Documentación

| Documento | Qué es |
|---|---|
| [`docs/HOJA-DE-RUTA.md`](docs/HOJA-DE-RUTA.md) | Estado de las 85 historias de usuario y lo que falta |
| [`docs/DESPLIEGUE-SIN-TARJETA.md`](docs/DESPLIEGUE-SIN-TARJETA.md) | Cómo se desplegó en AWS **sin tarjeta de crédito** y con costo USD $0 (incluye su PDF) |
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) | Manual operativo del despliegue en EC2 (equipo) |
| [`docs/ESTADO-DESPLIEGUE-AWS.md`](docs/ESTADO-DESPLIEGUE-AWS.md) | Cómo está desplegado hoy: infraestructura, costo, controles de seguridad y cómo encender y apagar la app |
| `docs/NOTA-TECNICA-*.md` | Decisiones de diseño (Flyway, contrato de eventos, diseñador de flujos) y medición del peso de cada servicio |

## Frontend

- **Stack:** Vite + React 19 + React Router 7, sin dependencias de UI externas
  (el sistema de diseño vive en `src/styles.css`).
- **Sesión:** el JWT de acceso dura 30 minutos; cuando vence (o cuando un
  administrador cambia los roles o permisos del usuario) el cliente lo renueva
  solo con el token de refresco y repite la petición, sin sacar al usuario.
- **Permisos (HU-013):** el menú y las rutas solo ofrecen las vistas cuyos
  permisos trae la sesión; una URL escrita a mano sin permiso vuelve al panel.

| Vista | Ruta | Endpoints que consume | HU |
|-------|------|----------------------|-----|
| Autenticación | `/login` | `POST /auth/login`, `/auth/refrescar`, `/auth/logout` | HU-001, HU-002 |
| Panel | `/app` | conteos de usuarios, roles y catálogos según permisos | — |
| Usuarios | `/app/usuarios` | `GET/POST/PUT/DELETE /usuarios`, `PUT /usuarios/{id}/roles` | HU-003…HU-006, HU-012 |
| Roles y permisos | `/app/roles` | `GET/POST/PUT/DELETE /roles`, `GET /permisos`, `PUT /roles/{id}/permisos` | HU-007…HU-011 |
| Parámetros | `/app/configuracion` | `GET/POST/PUT/DELETE /areas`, `/tipos-documentales`, `/entidades` | HU-015, HU-016, HU-022 |

### Ejecutar en local

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxy /api/usuarios → localhost:8081)
```

El servicio de usuarios debe estar arriba (ver abajo). Para apuntar el proxy a
otra dirección: `USUARIOS_URL=http://host:puerto npm run dev`.

### Pruebas de punta a punta (Playwright)

```bash
cd frontend
npm run test:e2e        # 13 pruebas en escritorio y celular, con el Chrome instalado
```

Playwright levanta su propio servicio (puerto 8082, perfil `test` con H2 en
memoria) y su propio frontend (puerto 5174), así que no interfiere con los
servidores de desarrollo. Cubren login, panel, permisos por rol, renovación del
token, alta de usuarios y áreas, uso con teclado y que nada desborde en el
celular. El reporte queda en `frontend/playwright-report/`.

## Contenedores

```bash
cp .env.example .env          # y completa los secretos
docker compose up --build     # frontend en http://localhost:8080
```

`docker compose` se niega a arrancar si falta un secreto en `.env`: así nunca
se levanta con claves conocidas. nginx sirve la SPA y reenvía `/api/usuarios/*`
al servicio, de modo que el navegador solo habla con un origen.

| Contenedor | Puerto | Descripción |
|------------|--------|-------------|
| `neptuno-frontend` | 8080 | SPA + proxy de `/api/usuarios/*` |
| `neptuno-usuarios` | 8081 | servicio de usuarios (ms-auth-catalogs) |
| `neptuno-db-usuarios` | interno | MySQL 8 con `auth_catalogs_db` |
| `neptuno-documentos` | 8082 | servicio de documentos (ms-document-management) |
| `neptuno-db-documentos` | interno | MySQL 8 con `document_management_db` |
| `neptuno-rabbitmq` | 15672 | broker de eventos hacia ms-audit-infra (consola web) |

## Servicio de documentos (`ms-document-management`)

Primera parte: **radicación** (HU-017…HU-021, HU-023, HU-024, HU-039, HU-040).
Anexos, expediente, plantillas y copias siguen pendientes. Valida el JWT que emite
`servicio-usuarios` (mismo `JWT_SECRETO`) y consulta sus catálogos con el token del usuario.

| Método y ruta (`/api/documentos`) | Permiso | HU |
|-----------------------------------|---------|----|
| `POST /radicados` | `radicados:crear` (+ `radicados:radicar-recibido` si el origen es RECIBIDO, + `radicados:clase` para COPIA) | HU-017, 018, 019, 024, 039, 040 |
| `GET /radicados` (filtros: `codigo`, `q`, `desde`, `hasta`, `origen`, `tipoDocumentalId`, `areaId`, `estado`, `pagina`, `tamanio`) | `radicados:consultar` | HU-023 |
| `GET /radicados/{id}` | `radicados:consultar` | HU-020 |
| `PUT /radicados/{id}` (exige `version`; el código y el origen no cambian) | `radicados:editar` | HU-021, 039 |

El código es `AAAAMMDD` + dígito del origen (1 Interno, 2 Externo, 3 Recibido) + consecutivo de
4 cifras por día y origen, con la fecha en hora de Bogotá. Cada creación y edición deja un evento
en la tabla outbox, que se publica en RabbitMQ para la bitácora.

```bash
cd servicio-documentos
npm ci
npm test                                   # API con repositorio en memoria
PRUEBA_MYSQL_HOST=127.0.0.1 npm test       # añade las pruebas contra un MySQL real (crea y borra la base documentos_prueba)
```

Para correrlo en local sin Docker hacen falta las variables `JWT_SECRETO`, `DB_CLAVE` y `RABBIT_CLAVE`
(ver `src/config.js`); la base `document_management_db` se migra sola al arrancar.

## Servicio de usuarios (`ms-auth-catalogs`)

Autenticación, seguridad y datos maestros: inicio y cierre de sesión con JWT,
control de acceso basado en roles y permisos (RBAC), administración de usuarios y
roles, y catálogos de áreas, tipos documentales y entidades.

- **Stack:** Java 21 · Spring Boot 3.5 · Spring Security (JWT HS256) · Spring Data JPA ·
  Flyway · MySQL 8 · RabbitMQ · springdoc OpenAPI.
- **Eventos de bitácora:** patrón *transactional outbox*. Cada cambio guarda su
  evento en la misma transacción y una tarea programada lo envía a RabbitMQ;
  si el broker cae, la operación del usuario no se ve afectada.
- **Trazabilidad:** [`docs/MATRIZ-API-HU.md`](docs/MATRIZ-API-HU.md) relaciona cada HU
  con su endpoint, el permiso que exige y la prueba que la verifica.

### Ejecutar en local

```bash
# 1. Base de datos y broker (o usa docker compose completo)
docker run -d --name neptuno-db-usuarios -p 3306:3306 \
  -e MYSQL_DATABASE=auth_catalogs_db -e MYSQL_USER=neptuno -e MYSQL_PASSWORD=neptuno \
  -e MYSQL_ROOT_PASSWORD=root mysql:8.4

# 2. Servicio con el perfil local (secretos de desarrollo, nunca para producción)
cd servicio-usuarios
mvn spring-boot:run -Dspring-boot.run.profiles=local   # http://localhost:8081/api/usuarios
mvn test                                               # 38 pruebas de integración con H2
```

- **Swagger UI:** http://localhost:8081/api/usuarios/documentacion
- **Administrador inicial:** se crea una sola vez con `ADMIN_CORREO` / `ADMIN_CLAVE`
  (en el perfil `local`, los valores de `application-local.yml`). Se siembran además
  25 permisos —el rol Administrador recibe 24: `radicados:radicar-recibido` es
  exclusivo del rol Radicador, HU-024—, 6 roles, 6 áreas, 7 tipos documentales y
  5 entidades.
- **Sin perfil `local`** el servicio exige `JWT_SECRETO`, `CLAVE_SERVICIOS`,
  `DB_CLAVE`, `RABBIT_CLAVE`, `ADMIN_CORREO` y `ADMIN_CLAVE` como variables de entorno.
- **API interna entre microservicios:** `/api/usuarios/interno/**` se autentica con la
  cabecera `X-Servicio-Clave` (variable `CLAVE_SERVICIOS`).
- **CORS:** solo para desarrollo sin nginx; orígenes en `CORS_ORIGENES`
  (por defecto `http://localhost:5173`).
