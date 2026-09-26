# Neptuno · Sistema de Gestión Documental

Repositorio monorepo que sigue una metodología de **microservicios**, con un
frontend y un servicio por dominio. La identidad visual del sistema usa la
paleta institucional **azul, rojo y blanco**.

> **Estado actual:** solo está implementado el **frontend** (`frontend/`). Las
> vistas están pobladas con datos mock para navegarlas y tomar capturas de
> "mockup". Los servicios de dominio se agregarán en las carpetas indicadas.

## Estructura del proyecto

```
Neptuno/
├── frontend/                     # SPA (Vite + React)  ← implementado
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── servicio-usuarios/            # pendiente (usuarios, roles y permisos)
│   ├── src/
│   ├── requirements.txt | package.json | go.mod
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
- **Sin backend:** todas las vistas usan datos mock en `src/data/mock.js`.

### Ejecutar en local

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

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
modo que el navegador solo habla con un origen. Los bloques de los servicios
están comentados en `docker-compose.yml` hasta que se implementen.
