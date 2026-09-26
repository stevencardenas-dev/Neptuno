# Capturas de las vistas de Neptuno

Generadas automáticamente con `node tools/capturar-vistas.mjs` (Chrome headless
por CDP, sin dependencias). Cada imagen incluye en su encabezado el nombre de la
vista y las historias de usuario que cubre. Las vistas más altas se parten en
varias capturas, numeradas como "parte N de M".

Para regenerarlas con el frontend levantado:

```bash
cd frontend && npm run dev        # http://localhost:5173
cd ..
NEPTUNO_URL=http://localhost:5173 node tools/capturar-vistas.mjs
```

## Índice

| Archivo | Vista | Historias de usuario | Ruta | Captura |
|---------|-------|----------------------|------|---------|
| `01-indice-de-mockups-parte-1.png` | Índice de mockups (portada) | Referencia general del prototipo | / | 1 de 2 |
| `01-indice-de-mockups-parte-2.png` | Índice de mockups (portada) | Referencia general del prototipo | / | 2 de 2 |
| `02-autenticacion-y-acceso.png` | Autenticación y acceso | HU-001, HU-002 | /login | 1 de 1 |
| `03-panel-general-parte-1.png` | Panel general | Resumen operativo (transversal) | /app | 1 de 2 |
| `03-panel-general-parte-2.png` | Panel general | Resumen operativo (transversal) | /app | 2 de 2 |
| `04-radicacion-de-documentos-parte-1.png` | Radicación de documentos | HU-017 … HU-041 | /app/radicacion | 1 de 3 |
| `04-radicacion-de-documentos-parte-2.png` | Radicación de documentos | HU-017 … HU-041 | /app/radicacion | 2 de 3 |
| `04-radicacion-de-documentos-parte-3.png` | Radicación de documentos | HU-017 … HU-041 | /app/radicacion | 3 de 3 |
| `05-consulta-y-buscador-parte-1.png` | Consulta y buscador de radicados | HU-020, HU-023, HU-028 | /app/radicados | 1 de 2 |
| `05-consulta-y-buscador-parte-2.png` | Consulta y buscador de radicados | HU-020, HU-023, HU-028 | /app/radicados | 2 de 2 |
| `06-bandeja-tareas-pendientes-parte-1.png` | Bandeja de entrada y tareas pendientes | HU-042, HU-062 … HU-068, HU-070, HU-071, HU-074, HU-075, HU-083 | /app/bandeja | 1 de 2 |
| `06-bandeja-tareas-pendientes-parte-2.png` | Bandeja de entrada y tareas pendientes | HU-042, HU-062 … HU-068, HU-070, HU-071, HU-074, HU-075, HU-083 | /app/bandeja | 2 de 2 |
| `07-bandeja-copias-recibidas.png` | Bandeja de entrada · copias recibidas | HU-042 | /app/bandeja | 1 de 1 |
| `08-expediente-central.png` | Expediente central (archivo) | HU-030 … HU-033 | /app/expediente | 1 de 1 |
| `09-usuarios-listado.png` | Administración de usuarios | HU-003 … HU-006, HU-012 | /app/usuarios | 1 de 1 |
| `10-usuarios-crear.png` | Administración de usuarios · crear usuario | HU-003, HU-012 | /app/usuarios | 1 de 1 |
| `11-roles-y-permisos-parte-1.png` | Roles y permisos | HU-007 … HU-011 | /app/roles | 1 de 2 |
| `11-roles-y-permisos-parte-2.png` | Roles y permisos | HU-007 … HU-011 | /app/roles | 2 de 2 |
| `12-roles-asignar-permisos.png` | Roles y permisos · asignar permisos a un rol | HU-011 | /app/roles | 1 de 1 |
| `13-parametros-tipos-documentales.png` | Parámetros del sistema · tipos documentales | HU-015 | /app/configuracion | 1 de 1 |
| `14-parametros-areas.png` | Parámetros del sistema · áreas | HU-016 | /app/configuracion | 1 de 1 |
| `15-parametros-entidades.png` | Parámetros del sistema · entidades | HU-022 | /app/configuracion | 1 de 1 |
| `16-parametros-copias-de-seguridad-parte-1.png` | Parámetros del sistema · copias de seguridad | HU-081, HU-082 | /app/configuracion | 1 de 2 |
| `16-parametros-copias-de-seguridad-parte-2.png` | Parámetros del sistema · copias de seguridad | HU-081, HU-082 | /app/configuracion | 2 de 2 |
| `17-gestion-de-plantillas-parte-1.png` | Gestión de plantillas y renderizado | HU-035 … HU-038 | /app/plantillas | 1 de 2 |
| `17-gestion-de-plantillas-parte-2.png` | Gestión de plantillas y renderizado | HU-035 … HU-038 | /app/plantillas | 2 de 2 |
| `18-flujos-lienzo-parte-1.png` | Diseñador de flujos de trabajo · lienzo | HU-048 … HU-061, HU-069, HU-072, HU-073, HU-076, HU-078 … HU-080 | /app/flujos | 1 de 2 |
| `18-flujos-lienzo-parte-2.png` | Diseñador de flujos de trabajo · lienzo | HU-048 … HU-061, HU-069, HU-072, HU-073, HU-076, HU-078 … HU-080 | /app/flujos | 2 de 2 |
| `19-flujos-listado-parte-1.png` | Diseñador de flujos de trabajo · listado de flujos | HU-048 … HU-051 | /app/flujos | 1 de 2 |
| `19-flujos-listado-parte-2.png` | Diseñador de flujos de trabajo · listado de flujos | HU-048 … HU-051 | /app/flujos | 2 de 2 |
| `20-flujos-versiones-parte-1.png` | Diseñador de flujos de trabajo · versiones | HU-078 … HU-080 | /app/flujos | 1 de 2 |
| `20-flujos-versiones-parte-2.png` | Diseñador de flujos de trabajo · versiones | HU-078 … HU-080 | /app/flujos | 2 de 2 |
| `21-bitacora-y-auditoria-parte-1.png` | Bitácora y auditoría | HU-043 … HU-047, HU-077 | /app/bitacora | 1 de 3 |
| `21-bitacora-y-auditoria-parte-2.png` | Bitácora y auditoría | HU-043 … HU-047, HU-077 | /app/bitacora | 2 de 3 |
| `21-bitacora-y-auditoria-parte-3.png` | Bitácora y auditoría | HU-043 … HU-047, HU-077 | /app/bitacora | 3 de 3 |
| `22-rendimiento.png` | Rendimiento (requisitos transversales) | HU-084, HU-085 | /app/rendimiento | 1 de 1 |

## Trazabilidad completa

La relación de las 85 historias de usuario con cada vista está en
[`../docs/MATRIZ-VISTAS-HU.md`](../docs/MATRIZ-VISTAS-HU.md).
