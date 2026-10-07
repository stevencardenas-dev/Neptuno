# Neptuno · Sistema de Gestión Documental

Repositorio monorepo que sigue una metodología de **microservicios**, con un
frontend y un servicio por dominio. La identidad visual del sistema usa la
paleta institucional **azul, rojo y blanco**.

> **Estado actual:** implementados el **frontend** (`frontend/`) y el
> **servicio de usuarios** (`servicio-usuarios/`, Java 21 + Spring Boot + MySQL).
> Todas las vistas del frontend consumen ese servicio con JWT real; no hay datos
> de ejemplo. El plan para el resto del backlog y las funcionalidades nuevas
> propuestas está en [`docs/HOJA-DE-RUTA.md`](docs/HOJA-DE-RUTA.md).

## Estructura del proyecto

```
Neptuno/
├── frontend/                 # SPA (Vite + React) servida por nginx
├── servicio-usuarios/        # ms-auth-catalogs: Java 21 + Spring Boot (HU-001…HU-016, HU-022)
├── docs/
│   ├── Neptuno_Proyecto.docx                       # documento del proyecto (arquitectura y 85 HU)
│   ├── Neptuno_Requerimientos_Backlog_Sprints.xlsx # requerimientos, backlog con microservicio y endpoint por HU, sprints
│   ├── esquema-base-datos.sql                      # tablas de las HU pendientes (3 bases MySQL)
│   ├── MATRIZ-API-HU.md      # trazabilidad endpoint ↔ historia de usuario (servicio implementado)
│   └── HOJA-DE-RUTA.md       # próximos microservicios y funcionalidades propuestas
├── .github/workflows/ci.yml  # pruebas del backend y build del frontend en cada PR
├── docker-compose.yml        # frontend + servicio + MySQL + RabbitMQ
└── .env.example              # plantilla de secretos para docker compose
```

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
| `neptuno-rabbitmq` | 15672 | broker de eventos hacia ms-audit-infra (consola web) |

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
