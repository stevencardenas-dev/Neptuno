# Matriz de trazabilidad · Vistas ↔ Historias de usuario

Relación entre cada vista del frontend de Neptuno y las historias de usuario
(HU) del backlog que cubre. Sirve como guía para navegar el prototipo y tomar
las capturas de mockup.

- **Fuente:** `vistas.txt` (backlog de 85 historias de usuario).
- **Implementación:** `frontend/` (Vite + React). Datos de ejemplo en
  `frontend/src/data/mock.js`.
- **Índice navegable de mockups:** ruta `/` del frontend.

## Vistas conectadas al servicio real

Cuatro vistas dejaron de usar datos de ejemplo y consumen el API de
`servicio-usuarios` (`ms-auth-catalogs`) con el JWT de la sesión. Las demás
siguen siendo prototipo porque sus microservicios aún no existen.

| Vista | Ruta | Endpoints | HU |
|-------|------|-----------|-----|
| Autenticación y acceso | `/login` | `POST /auth/login`, `POST /auth/logout` | HU-001, HU-002 |
| Administración de usuarios | `/app/usuarios` | `GET/POST/PUT/DELETE /usuarios`, `PUT /usuarios/{id}/roles` | HU-003…HU-006, HU-012 |
| Roles y permisos | `/app/roles` | `GET/POST/PUT/DELETE /roles`, `GET /permisos`, `PUT /roles/{id}/permisos` | HU-007…HU-011 |
| Configuración (catálogos) | `/app/configuracion` | `GET/POST/PUT/DELETE /areas`, `/tipos-documentales`, `/entidades` | HU-015, HU-016, HU-022 |

Las páginas privadas exigen sesión (guarda de rutas) y el menú solo muestra las
vistas cuyos permisos trae la sesión (HU-013). Las tablas de cada vista indican
el resultado real del servicio: un `403` aparece como "no tienes el permiso
requerido" y un `409` como conflicto de regla de negocio.

## Resumen por vista

| # | Vista | Ruta | HU cubiertas | Total |
|---|-------|------|--------------|:-----:|
| 1 | Autenticación y acceso | `/login` | HU-001, HU-002 | 2 |
| 2 | Panel general | `/app` | — (transversal, resumen operativo) | 0 |
| 3 | Radicación de documentos | `/app/radicacion` | HU-017…HU-019, HU-021, HU-024…HU-027, HU-029, HU-034, HU-039…HU-041 | 13 |
| 4 | Consulta y buscador de radicados | `/app/radicados` | HU-020, HU-023, HU-028 | 3 |
| 5 | Bandeja de entrada y tareas pendientes | `/app/bandeja` | HU-042, HU-062…HU-068, HU-070…HU-071, HU-074…HU-075, HU-083 | 13 |
| 6 | Expediente central (archivo) | `/app/expediente` | HU-030…HU-033 | 4 |
| 7 | Administración de usuarios | `/app/usuarios` | HU-003…HU-006, HU-012 | 5 |
| 8 | Roles y permisos | `/app/roles` | HU-007…HU-011 | 5 |
| 9 | Configuración y parámetros del sistema | `/app/configuracion` | HU-015, HU-016, HU-022, HU-081, HU-082 | 5 |

> Las filas 7, 8 y 9 tienen su catálogo conectado al servicio; la pestaña de
> copias de seguridad (HU-081, HU-082) sigue siendo prototipo.
| 10 | Gestión de plantillas y renderizado | `/app/plantillas` | HU-035…HU-038 | 4 |
| 11 | Diseñador de flujos de trabajo | `/app/flujos` | HU-048…HU-061, HU-069, HU-072…HU-073, HU-076, HU-078…HU-080 | 21 |
| 12 | Bitácora y auditoría | `/app/bitacora` | HU-043…HU-047, HU-077 | 6 |
| 13 | Rendimiento (transversal) | `/app/rendimiento` | HU-084, HU-085 | 2 |

> **Nota sobre HU-013 y HU-014** (validación de permisos y visibilidad por rol/área):
> son requisitos de sistema transversales. Se documentan en las vistas de
> Usuarios/Roles (tarjeta "Usuarios con este rol"), Expediente ("Visibilidad por
> rol y área") y en los avisos de Radicación y Bandeja.

## Detalle por historia de usuario

| HU | Vista | Ruta | Enunciado (resumen) |
|----|-------|------|---------------------|
| HU-001 | Autenticación | `/login` | Iniciar sesión con credenciales para acceder según el perfil |
| HU-002 | Autenticación | `/login` | Cerrar sesión para evitar uso de la cuenta en equipos compartidos |
| HU-003 | Usuarios | `/app/usuarios` | Crear usuario (nombre, correo, área y estado) |
| HU-004 | Usuarios | `/app/usuarios` | Editar datos de un usuario existente |
| HU-005 | Usuarios | `/app/usuarios` | Eliminar usuario por baja lógica sin perder su historial |
| HU-006 | Usuarios | `/app/usuarios` | Listar y filtrar usuarios por nombre, rol o estado |
| HU-007 | Roles y permisos | `/app/roles` | Crear un rol para agrupar permisos de un perfil |
| HU-008 | Roles y permisos | `/app/roles` | Editar nombre y descripción de un rol |
| HU-009 | Roles y permisos | `/app/roles` | Eliminar un rol sin usuarios asignados |
| HU-010 | Roles y permisos | `/app/roles` | Listar roles con sus permisos y usuarios asignados |
| HU-011 | Roles y permisos | `/app/roles` | Asignar o quitar permisos sobre funcionalidades a un rol |
| HU-012 | Usuarios | `/app/usuarios` | Asignar o quitar uno o varios roles a un usuario |
| HU-013 | Transversal (Usuarios/Roles) | `/app/usuarios`, `/app/roles` | Validar en cada solicitud los permisos del rol del usuario |
| HU-014 | Transversal (Expediente) | `/app/expediente` | Limitar la visibilidad de documentos según rol y área |
| HU-015 | Configuración | `/app/configuracion` | Crear, editar y desactivar tipos documentales |
| HU-016 | Configuración | `/app/configuracion` | Crear, editar y desactivar áreas de la organización |
| HU-017 | Radicación | `/app/radicacion` | Asignar código de radicado único e inmutable (AAAAMMDD+X+CONSECUTIVO) |
| HU-018 | Radicación | `/app/radicacion` | Clasificar el documento como Interno, Externo, Recibido o No radicable |
| HU-019 | Radicación | `/app/radicacion` | Diligenciar metadatos obligatorios sin permitir campos vacíos |
| HU-020 | Consulta y buscador | `/app/radicados` | Consultar el detalle de un radicado (metadatos, anexos y estado) |
| HU-021 | Radicación | `/app/radicacion` | Editar metadatos sin alterar el código |
| HU-022 | Configuración | `/app/configuracion` | Crear y consultar entidades (NIT y razón social) |
| HU-023 | Consulta y buscador | `/app/radicados` | Listar y filtrar radicados por código, fecha, origen, tipo y área |
| HU-024 | Radicación | `/app/radicacion` | Solo el rol Radicador registra documentos de origen Recibido |
| HU-025 | Radicación | `/app/radicacion` | Adjuntar un archivo digital a un radicado |
| HU-026 | Radicación | `/app/radicacion` | Aceptar únicamente PDF, PNG, JPG, DOCX y XLSX |
| HU-027 | Radicación | `/app/radicacion` | Adjuntar varios archivos a la vez |
| HU-028 | Consulta y buscador | `/app/radicados` | Visualizar y descargar los anexos de un radicado |
| HU-029 | Radicación | `/app/radicacion` | Eliminar un anexo cargado por error dejando constancia |
| HU-030 | Expediente | `/app/expediente` | Crear y organizar carpetas principales por área |
| HU-031 | Expediente | `/app/expediente` | Crear subcarpetas temáticas dentro de un área |
| HU-032 | Expediente | `/app/expediente` | Visualizar el expediente como árbol de carpetas y documentos |
| HU-033 | Expediente | `/app/expediente` | Filtrar la visibilidad de carpetas según permisos del rol |
| HU-034 | Radicación | `/app/radicacion` | Subir No radicable a una subcarpeta del expediente con consecutivo |
| HU-035 | Plantillas | `/app/plantillas` | Subir plantilla y definir etiquetas o variables dinámicas |
| HU-036 | Plantillas | `/app/plantillas` | Vincular una plantilla solo a los orígenes Interno o Externo |
| HU-037 | Plantillas | `/app/plantillas` | Reemplazar automáticamente las variables con los metadatos |
| HU-038 | Plantillas | `/app/plantillas` | Convertir el documento renderizado en PDF final |
| HU-039 | Radicación | `/app/radicacion` | Registrar metadatos extendidos (NIT, entidad, área, carpeta, comentarios) |
| HU-040 | Radicación | `/app/radicacion` | Asignar clase Original o Copia a cada documento |
| HU-041 | Radicación | `/app/radicacion` | Seleccionar destinatarios para enviarles un duplicado (copia) |
| HU-042 | Bandeja | `/app/bandeja` | Ver las copias recibidas en una sección separada |
| HU-043 | Bitácora | `/app/bitacora` | Registrar cada acción sobre un documento (quién, qué y cuándo) |
| HU-044 | Bitácora | `/app/bitacora` | Impedir modificar o eliminar registros de la bitácora |
| HU-045 | Bitácora | `/app/bitacora` | Registrar cada cambio de estado con las observaciones del responsable |
| HU-046 | Bitácora | `/app/bitacora` | Consultar el historial completo de un documento en orden cronológico |
| HU-047 | Bitácora | `/app/bitacora` | Filtrar la bitácora por usuario, rango de fechas y tipo de acción |
| HU-048 | Diseñador de flujos | `/app/flujos` | Crear un flujo de trabajo (nombre y descripción) |
| HU-049 | Diseñador de flujos | `/app/flujos` | Editar los datos generales de un flujo |
| HU-050 | Diseñador de flujos | `/app/flujos` | Eliminar (archivar) un flujo sin documentos en tránsito |
| HU-051 | Diseñador de flujos | `/app/flujos` | Consultar el listado de flujos con su estado |
| HU-052 | Diseñador de flujos | `/app/flujos` | Ver el flujo en un lienzo gráfico con estados y transiciones |
| HU-053 | Diseñador de flujos | `/app/flujos` | Agregar un estado (paso) desde el lienzo |
| HU-054 | Diseñador de flujos | `/app/flujos` | Editar nombre y descripción de un estado |
| HU-055 | Diseñador de flujos | `/app/flujos` | Marcar el estado inicial y los estados finales |
| HU-056 | Diseñador de flujos | `/app/flujos` | Crear una transición con acción y estado destino |
| HU-057 | Diseñador de flujos | `/app/flujos` | Editar la acción y el destino de una transición |
| HU-058 | Diseñador de flujos | `/app/flujos` | Eliminar una transición que ya no aplique |
| HU-059 | Diseñador de flujos | `/app/flujos` | Asociar roles o áreas a un estado del flujo |
| HU-060 | Diseñador de flujos | `/app/flujos` | Quitar un rol o área asignado a un estado |
| HU-061 | Diseñador de flujos | `/app/flujos` | Publicar un flujo validando que esté completo |
| HU-062 | Bandeja | `/app/bandeja` | Enviar un radicado a un flujo de trabajo activo |
| HU-063 | Bandeja | `/app/bandeja` | Ver la bandeja con los documentos pendientes de mi rol o área |
| HU-064 | Bandeja | `/app/bandeja` | Filtrar y ordenar la bandeja por fecha, tipo documental y origen |
| HU-065 | Bandeja | `/app/bandeja` | Abrir una tarea para ver metadatos y anexos antes de decidir |
| HU-066 | Bandeja | `/app/bandeja` | Aprobar un documento para que avance al siguiente estado |
| HU-067 | Bandeja | `/app/bandeja` | Rechazar un documento con observación obligatoria |
| HU-068 | Bandeja | `/app/bandeja` | Devolver un documento al estado anterior con observaciones |
| HU-069 | Diseñador de flujos | `/app/flujos` | Configurar si un nodo lo atiende persona, grupo o rol |
| HU-070 | Bandeja | `/app/bandeja` | Tomar la responsabilidad de un documento (asignación exclusiva) |
| HU-071 | Bandeja | `/app/bandeja` | Impedir que más de un usuario posea o edite el documento original |
| HU-072 | Diseñador de flujos | `/app/flujos` | Definir la duración máxima global del trámite |
| HU-073 | Diseñador de flujos | `/app/flujos` | Definir la duración máxima permitida para resolver un nodo |
| HU-074 | Bandeja | `/app/bandeja` | Ver indicadores de color (verde, amarillo, rojo) según tiempo restante |
| HU-075 | Bandeja | `/app/bandeja` | Aplicar firma digital/electrónica a un documento autorizado |
| HU-076 | Diseñador de flujos | `/app/flujos` | Marcar los estados que exigen firma |
| HU-077 | Bitácora | `/app/bitacora` | Ver quién firmó un documento y cuándo lo hizo |
| HU-078 | Diseñador de flujos | `/app/flujos` | Crear una nueva versión de un flujo activo |
| HU-079 | Diseñador de flujos | `/app/flujos` | Los documentos en tránsito conservan la versión con la que iniciaron |
| HU-080 | Diseñador de flujos | `/app/flujos` | Consultar las versiones de un flujo con fecha y autor |
| HU-081 | Configuración | `/app/configuracion` | Configurar copias de seguridad periódicas |
| HU-082 | Configuración | `/app/configuracion` | Restaurar documentos y bitácora desde una copia de seguridad |
| HU-083 | Bandeja | `/app/bandeja` | Consultar y aprobar documentos desde el celular |
| HU-084 | Rendimiento | `/app/rendimiento` | Medir y optimizar la carga y transición de estados (límite de 2 s) |
| HU-085 | Rendimiento | `/app/rendimiento` | Ejecutar pruebas de carga con N usuarios concurrentes |
