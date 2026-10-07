# Matriz de trazabilidad · API del servicio de usuarios ↔ Historias de usuario

Relación entre cada historia de usuario del backlog de Neptuno cubierta por el
microservicio **servicio-usuarios (`ms-auth-catalogs`)** y los endpoints que la
implementan, con la prueba automatizada que la verifica.

- **Stack:** Java 21 + Spring Boot 3.5, Spring Security (JWT), JPA + Flyway, MySQL 8.
- **Base de datos:** `auth_catalogs_db` (una base por microservicio).
- **Ruta base:** `/api/usuarios` (nginx reparte `/api/usuarios/*` a este servicio).
- **Documentación interactiva:** `/api/usuarios/documentacion` (Swagger UI).
- **Pruebas:** `mvn test` → 38 pruebas de integración (`src/test/java/.../*Prueba.java`).

## Historias cubiertas

| HU | Historia | Método y ruta | Permiso requerido (HU-013) | Prueba |
|----|----------|---------------|----------------------------|--------|
| HU-001 | Iniciar sesión | `POST /auth/login`, `GET /auth/sesion` | público / sesión | `AutenticacionPrueba` |
| HU-002 | Cerrar sesión | `POST /auth/logout` | sesión | `AutenticacionPrueba` |
| HU-003 | Crear usuario | `POST /usuarios` | `usuarios:crear` | `UsuariosPrueba` |
| HU-004 | Editar usuario | `PUT /usuarios/{id}` | `usuarios:editar` | `UsuariosPrueba` |
| HU-005 | Eliminar usuario (baja lógica) | `DELETE /usuarios/{id}` | `usuarios:eliminar` | `UsuariosPrueba`, `UltimoAdministradorPrueba` |
| HU-006 | Consultar y buscar usuarios | `GET /usuarios`, `GET /usuarios/{id}` | `usuarios:consultar` | `UsuariosPrueba` |
| HU-007 | Crear rol | `POST /roles` | `roles:crear` | `RolesPrueba` |
| HU-008 | Editar rol | `PUT /roles/{id}` | `roles:editar` | `RolesPrueba` |
| HU-009 | Eliminar rol | `DELETE /roles/{id}` | `roles:eliminar` | `RolesPrueba` |
| HU-010 | Consultar roles | `GET /roles`, `GET /roles/{id}`, `GET /roles/{id}/usuarios` | `roles:consultar` | `RolesPrueba` |
| HU-011 | Asignar permisos a un rol | `PUT /roles/{id}/permisos`, `GET /permisos` | `roles:asignar-permisos` / `roles:consultar` | `RolesPrueba`, `CatalogoPermisosPrueba` |
| HU-012 | Asignar roles a un usuario | `PUT /usuarios/{id}/roles` | `usuarios:asignar-roles` | `UsuariosPrueba` |
| HU-013 | Restringir el acceso por rol | Filtro JWT + `@PreAuthorize` en todos los endpoints | — | Todas las clases de prueba |
| HU-014 | Restringir el acceso a documentos por rol | `GET /interno/usuarios/{id}/contexto-acceso`, `GET /interno/usuarios/contextos` | `X-Servicio-Clave` | `InternoPrueba` |
| HU-015 | Administrar tipos documentales | `GET/POST/PUT/DELETE /tipos-documentales` | `catalogos:consultar` / `catalogos:administrar` | `CatalogosPrueba` |
| HU-016 | Administrar catálogo de áreas | `GET/POST/PUT/DELETE /areas` | `catalogos:consultar` / `catalogos:administrar` | `CatalogosPrueba` |
| HU-022 | Administrar entidades | `GET/POST/PUT/DELETE /entidades` | `catalogos:consultar` / `catalogos:administrar` | `CatalogosPrueba` |

> HU-014 es transversal: este servicio publica el rol y el área del usuario y
> ms-documental los consume para filtrar la visibilidad de los documentos.

## Endpoints de apoyo

| Ruta | Descripción |
|------|-------------|
| `POST /auth/refrescar` | Renueva el token de acceso rotando el token de refresco |
| `PUT /usuarios/{id}/clave` | Cambia la contraseña de un usuario (requiere `usuarios:editar`) |
| `GET /catalogos/origenes` | Dígitos del formato de radicado AAAAMMDD + X + CONSECUTIVO (1 Interno, 2 Externo, 3 Recibido, 4 No radicable) |
| `GET /permisos` | Catálogo de permisos agrupado por módulo, fuente de HU-011 |
| `GET /interno/usuarios/{id}/permisos/{codigo}` | Verifica si un usuario tiene un permiso concreto (consumo entre microservicios) |
| `GET /actuator/health` | Estado del servicio (lo usa el healthcheck del contenedor) |

## Reglas de negocio relevantes

- **HU-005:** la baja lógica deja el usuario en estado `INACTIVO`, conserva
  `eliminadoEn` / `eliminadoPor` para la bitácora y revoca de inmediato sus tokens.
  No se puede dar de baja la propia cuenta ni al último administrador activo.
- **HU-009:** solo se eliminan roles sin usuarios asignados; los roles de sistema
  (Administrador) no se eliminan ni se renombran.
- **HU-013:** cada endpoint declara el permiso que exige; los permisos viajan en el
  JWT y se revalidan en cada solicitud contra el estado del usuario. Si cambian
  los roles del usuario o los permisos de uno de sus roles, los tokens de acceso
  emitidos antes se rechazan (`usuario.permisos_actualizados_en`) y el frontend
  los renueva con el refresco (`SeguridadSesionPrueba`).
- **HU-016/HU-015/HU-022:** los catálogos se desactivan, no se borran, para no
  invalidar documentos históricos; un área con usuarios asignados no se desactiva.
- **HU-024:** `radicados:radicar-recibido` se siembra únicamente en el rol Radicador
  (el Administrador recibe los otros 24 permisos), para que ms-documental pueda
  exigir que solo los Radicadores radiquen documentos de origen Recibido. La
  migración `V2__hu024_permiso_recibido_exclusivo.sql` corrige las bases ya sembradas.
- **Bitácora:** cada acción publica un evento en RabbitMQ (`neptuno.eventos` →
  `audit.infrastructure`) y conserva una copia local con estado de publicación para
  reintentar si el broker no está disponible.
