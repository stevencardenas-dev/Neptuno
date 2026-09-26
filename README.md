# Neptuno · Sistema de Gestión Documental

Repositorio monorepo que sigue una metodología de **microservicios**, con un
frontend y un servicio por dominio. La identidad visual del sistema usa la
paleta institucional **azul, rojo y blanco**.

> **Estado actual:** implementados el **frontend** (`frontend/`) y el
> **servicio de usuarios** (`servicio-usuarios/`, Java 21 + Spring Boot + MySQL).
> Cuatro vistas del frontend ya consumen ese servicio con JWT real (login,
> usuarios, roles y parámetros); el resto sigue poblada con datos mock para tomar
> capturas de "mockup", porque sus microservicios todavía no existen.

## Estructura del proyecto

```
Neptuno/
├── frontend/                     # SPA (Vite + React)  ← implementado
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── servicio-usuarios/            # Java 21 + Spring Boot  ← implementado (HU-001…HU-016, HU-022)
│   ├── src/
│   ├── pom.xml
│   └── Dockerfile
├── servicio-pagos/               # pendiente
│   ├── src/
│   └── Dockerfile
├── servicio-inventario/          # pendiente
│   ├── src/
│   └── Dockerfile
├── servicio-notificaciones/      # pendiente
│   ├── src/
│   └── Dockerfile
├── docker-compose.yml            # levanta frontend + servicios + bases locales
├── .gitignore
└── README.md
```

## Frontend

- **Stack:** Vite + React 19 + React Router 7.
- **Sin dependencias de UI externas:** el sistema de diseño vive en
  `src/styles.css` (tokens, componentes y layout).
- **Servicio real:** cuatro vistas consumen el API de `servicio-usuarios` con el
  token JWT de la sesión; el resto usa datos mock en `src/data/mock.js`.

### Vistas conectadas al servicio

| Vista | Ruta | Endpoints que consume | HU |
|-------|------|----------------------|-----|
| Autenticación | `/login` | `POST /auth/login`, `POST /auth/logout` | HU-001, HU-002 |
| Usuarios | `/app/usuarios` | `GET/POST/PUT/DELETE /usuarios`, `PUT /usuarios/{id}/roles` | HU-003…HU-006, HU-012 |
| Roles y permisos | `/app/roles` | `GET/POST/PUT/DELETE /roles`, `GET /permisos`, `PUT /roles/{id}/permisos` | HU-007…HU-011 |
| Parámetros | `/app/configuracion` | `GET/POST/PUT/DELETE /areas`, `/tipos-documentales`, `/entidades` | HU-015, HU-016, HU-022 |

Las páginas privadas exigen sesión: sin token vigente el frontend vuelve a
`/login`, y el menú solo ofrece las vistas cuyos permisos trae la sesión
(HU-013). Con `npm run dev`, el proxy de `vite.config.js` reenvía `/api/*` al
servicio; en contenedores lo hace nginx.

> Las nueve vistas restantes siguen siendo prototipo con datos de ejemplo
> (radicación, radicados, bandeja, expediente, plantillas, flujos, bitácora,
> panel y rendimiento): sus microservicios todavía no están implementados.

### Ejecutar en local

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxy /api/* → localhost:8081)
```

Para que el login y las vistas conectadas funcionen, el servicio debe estar
arriba (ver [Servicio de usuarios](#servicio-de-usuarios-ms-auth-catalogs)):
`cd servicio-usuarios && mvn spring-boot:run`.

Build de producción:

```bash
npm run build
npm run preview
```

### Vistas / mockups

El índice en la ruta raíz (`/`) lista y enlaza todas las vistas para tomar
capturas. La trazabilidad completa entre cada historia de usuario y la vista que
la cubre está en [`docs/MATRIZ-VISTAS-HU.md`](docs/MATRIZ-VISTAS-HU.md).

Rutas disponibles:

| Ruta | Vista | Historias de usuario |
|------|-------|----------------------|
| `/login` | Autenticación y acceso | HU-001, HU-002 |
| `/app` | Panel general | — |
| `/app/radicacion` | Radicación de documentos | HU-017…HU-041 |
| `/app/radicados` | Consulta y buscador | HU-020, HU-023, HU-028 |
| `/app/bandeja` | Bandeja de tareas | HU-042, HU-062…HU-075, HU-083 |
| `/app/expediente` | Expediente central (archivo) | HU-030…HU-033 |
| `/app/usuarios` | Administración de usuarios | HU-003…HU-006, HU-012 |
| `/app/roles` | Roles y permisos | HU-007…HU-011 |
| `/app/configuracion` | Parámetros del sistema | HU-015, HU-016, HU-022, HU-081, HU-082 |
| `/app/plantillas` | Plantillas y renderizado | HU-035…HU-038 |
| `/app/flujos` | Diseñador de flujos (workflow builder) | HU-048…HU-080 |
| `/app/bitacora` | Bitácora y auditoría | HU-043…HU-047, HU-077 |
| `/app/rendimiento` | Rendimiento (transversal) | HU-084, HU-085 |

## Contenedores

```bash
docker compose up --build     # frontend en http://localhost:8080
```

nginx sirve la SPA y actúa como punto de entrada de la API: reenvía cada ruta
`/api/*` al microservicio correspondiente según las variables de entorno, de
modo que el navegador solo habla con un origen.

`docker compose up --build` levanta además:

| Contenedor | Puerto | Descripción |
|------------|--------|-------------|
| `neptuno-frontend` | 8080 | SPA + proxy de `/api/usuarios/*` |
| `neptuno-usuarios` | 8081 | servicio de usuarios (ms-auth-catalogs) |
| `neptuno-db-usuarios` | interno | MySQL 8 con `auth_catalogs_db` |
| `neptuno-rabbitmq` | 15672 | broker de eventos hacia ms-audit-infra (consola web) |

Los bloques de los servicios que aún no se implementan siguen comentados en
`docker-compose.yml`.

## Servicio de usuarios (`ms-auth-catalogs`)

Autenticación, seguridad y datos maestros: inicio y cierre de sesión con JWT,
control de acceso basado en roles y permisos (RBAC), administración de usuarios y
roles, y catálogos de áreas, tipos documentales y entidades.

- **Stack:** Java 21 · Spring Boot 3.5 · Spring Security (JWT HS256) · Spring Data JPA ·
  Flyway · MySQL 8 · RabbitMQ · springdoc OpenAPI.
- **Historias cubiertas:** HU-001…HU-016 y HU-022 del backlog (contexto delimitado
  IAM + Parametrización y Datos Maestros).
- **Trazabilidad:** [`docs/MATRIZ-API-HU.md`](docs/MATRIZ-API-HU.md) relaciona cada HU
  con su endpoint, el permiso que exige y la prueba que la verifica.

### Ejecutar en local

```bash
# 1. Base de datos y broker (o usa docker compose completo)
docker run -d --name neptuno-db-usuarios -p 3306:3306 \
  -e MYSQL_DATABASE=auth_catalogs_db -e MYSQL_USER=neptuno -e MYSQL_PASSWORD=neptuno \
  -e MYSQL_ROOT_PASSWORD=root mysql:8.4

# 2. Servicio
cd servicio-usuarios
mvn spring-boot:run          # http://localhost:8081/api/usuarios
mvn test                     # 35 pruebas de integración con H2 en memoria
```

- **Swagger UI:** http://localhost:8081/api/usuarios/documentacion
- **Usuario administrador inicial:** `laura.restrepo@neptuno.gov.co` / `Neptuno*2026`
  (se crea una sola vez, con el catálogo de 25 permisos —el rol Administrador recibe
  24: `radicados:radicar-recibido` es exclusivo del rol Radicador, HU-024—, 6 roles,
  6 áreas, 7 tipos documentales y 5 entidades). Cambia la clave y el `JWT_SECRETO`
  en producción.
- **API interna entre microservicios:** `/api/usuarios/interno/**` se autentica con la
  cabecera `X-Servicio-Clave` (variable `CLAVE_SERVICIOS`).
