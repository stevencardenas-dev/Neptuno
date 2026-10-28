# Nota técnica · Diseñador de flujos (`ms-workflow-bpm`, HU-048…HU-061)

**Asunto:** cómo quedó modelado el flujo de trabajo, qué garantiza y qué falta
**Fecha:** 17 de octubre de 2026 · Avance 2
**Servicio:** `servicio-workflow/` (Node 24 · NestJS) · base `workflow_bpm_db`
**Ruta base:** `/api/workflow` · permiso único: `flujos:administrar`

---

## 1. La decisión de fondo: el flujo no guarda su definición

Un flujo es una identidad (nombre, descripción, estado) y una serie de **versiones**. Los
pasos, las transiciones y los responsables viven en la versión, no en el flujo:

```
flujo ──1:N──> flujo_version ──1:N──> estado_flujo ──1:N──> estado_responsable
                        └────1:N────> transicion (origen → destino, con la acción)
flujo.version_activa_id ──> la versión publicada que usan los trámites nuevos
```

La razón es de operación, no de elegancia: si el administrador corrigiera el recorrido
mientras hay documentos circulando, esos documentos cambiarían de camino a mitad de
trámite. Con versiones, el trámite conserva la definición con la que nació y el cambio rige
para los trámites nuevos.

Consecuencia práctica en la interfaz: **un flujo en borrador se edita; un flujo publicado se
consulta**. Publicar es el acto que pone el recorrido en operación y, a partir de ahí, el
lienzo se vuelve de solo lectura con un aviso explícito. Para cambiar un flujo activo sin romper los trámites en curso, HU-078 abre una versión
nueva en borrador (`POST /flujos/{id}/versiones`) copiando la publicada; al publicarla, la
anterior queda reemplazada y los trámites en curso conservan la suya.

## 2. Permiso: `flujos:administrar`

El backlog pide `flujos:administrar (nuevo)` para las HU-048…HU-061. Al implementar el
diseñador se había creado `flujo:disenar`; se alineó con el backlog en la migración
`V6__hu052_permiso_administrar_flujos.sql` de `servicio-usuarios`, que **renombra** el código
(la concesión al rol Administrador sigue al permiso) y reescribe su descripción sin
referencias a las historias, porque ese texto se ve en la pantalla de roles. El
Administrador queda con 26 de los 27 permisos del catálogo; el que falta es
`radicados:radicar-recibido`, exclusivo del rol Radicador (HU-024).

## 3. Endpoints

| HU | Método y ruta | Qué hace | Respuesta |
|---|---|---|---|
| HU-048 | `POST /flujos` | Crea el flujo en `BORRADOR` | 201 |
| HU-051 | `GET /flujos` | Lista y busca por texto y estado, en páginas | 200 |
| HU-051 | `GET /flujos/{id}` | Detalle del flujo | 200 · 404 |
| HU-049 | `PUT /flujos/{id}` | Corrige nombre y descripción | 200 |
| HU-052 | `GET /flujos/{id}/grafo` | Pasos, transiciones, responsables y sitio de cada paso | 200 |
| HU-053 | `POST /flujos/{id}/estados` | Agrega un paso | 201 |
| HU-054 | `PUT /flujos/{id}/estados/{estadoId}` | Corrige nombre, descripción o sitio | 200 |
| HU-054 | `DELETE /flujos/{id}/estados/{estadoId}` | Retira el paso con sus transiciones | 200 |
| HU-055 | `PATCH /flujos/{id}/estados/{estadoId}/tipo` | Marca inicial, intermedio o final | 200 |
| HU-056 | `POST /flujos/{id}/transiciones` | Crea la acción que lleva de un paso a otro | 201 |
| HU-057 | `PUT /flujos/{id}/transiciones/{id}` | Cambia acción, destino o etiqueta | 200 |
| HU-058 | `DELETE /flujos/{id}/transiciones/{id}` | Elimina la transición | 200 |
| HU-059 | `POST /flujos/{id}/estados/{estadoId}/responsables` | Asigna un rol o un área al paso | 201 |
| HU-060 | `DELETE /flujos/{id}/estados/{estadoId}/responsables/{id}` | Quita el responsable | 200 |
| HU-061 | `POST /flujos/{id}/publicar` | Valida el flujo y publica la versión | 201 · 422 |
| HU-050 | `PATCH /flujos/{id}/desactivar` | Archiva el flujo | 200 · 409 |
| HU-050 | `PATCH /flujos/{id}/reactivar` | Devuelve el flujo a la operación | 200 · 409 |

Todas las rutas exigen el permiso `flujos:administrar` y un token `ACCESO` vigente. Cada
respuesta de escritura devuelve **el flujo dibujado otra vez** (`grafo`), para que el lienzo
se refresque con una sola llamada y no queden dos vistas desincronizadas.

Códigos de error, con la misma forma que los otros servicios
(`{ codigo, mensaje, detalles }`): `400 DATOS_INVALIDOS`, `401 NO_AUTENTICADO`,
`403 PROHIBIDO`, `404 NO_ENCONTRADO`, `409 CONFLICTO` y `422 FLUJO_INCOMPLETO`.

## 4. Qué valida la publicación (HU-061)

Publicar no es un cambio de estado: es una revisión. Si algo falta, se devuelven **todos**
los problemas juntos en un `422`, porque al administrador le sirve más la lista completa que
el primer error encontrado:

1. El flujo tiene al menos un paso.
2. Hay exactamente un paso inicial.
3. Hay al menos un paso final.
4. Ningún paso intermedio se queda sin salida.
5. Ningún paso final tiene salidas (sería contradictorio).
6. Todo paso se alcanza saliendo del inicial: no hay pasos aislados.

Ejemplo real de la respuesta, con el flujo a medio construir:

```json
{
  "codigo": "FLUJO_INCOMPLETO",
  "mensaje": "El flujo todavía no está completo para publicarse.",
  "detalles": [
    "El paso «Recibido» no tiene ninguna salida: nadie podría continuar el trámite.",
    "El paso «Pagado» no se alcanza desde el inicio: quedaría aislado."
  ]
}
```

## 5. Reglas que se sostienen en la base de datos

- **Un solo inicio por versión**: columna generada `inicial_version_id` con índice único en
  `estado_flujo`; el servicio además lo comprueba antes para poder explicarlo con un 409
  ("Ya hay un paso inicial: «X»").
- **Una acción por paso**: índice único `(estado_origen_id, accion)` en `transicion`. Un paso
  no puede tener dos "Aprobar" que lleven a sitios distintos.
- **Nada de extremos repetidos**: `check` de que el origen y el destino de una transición son
  pasos distintos.
- **Un responsable no se repite**: índice único `(estado_id, tipo_sujeto, sujeto_id)`.
- **La bitácora no se pierde**: pasos, transiciones, responsables, publicación y archivo
  entran a la bandeja de salida (`evento_saliente`) **en la misma transacción** que el
  cambio, y de ahí viajan a `ms-audit-infra` por la cola `audit.infrastructure`. Se agregaron
  doce hechos nuevos a la bitácora: `flujo.paso-agregado`, `flujo.paso-editado`,
  `flujo.paso-marcado`, `flujo.paso-retirado`, `flujo.transicion-agregada`,
  `flujo.transicion-editada`, `flujo.transicion-retirada`, `flujo.responsable-asignado`,
  `flujo.responsable-retirado`, `flujo.publicado`, `flujo.desactivado` y `flujo.reactivado`.

## 6. Validación contra `ms-auth-catalogs` (HU-059)

Los roles y las áreas no viven en la base del flujo: se comprueban contra
`servicio-usuarios` (`GET /api/usuarios/roles/{id}` y `/areas/{id}`) reenviando el token del
propio administrador, igual que hace `servicio-documentos`. Si el rol o el área no existen,
la asignación se rechaza con 404; si el catálogo no responde, con 503 (mejor no asignar un
responsable que no se pudo comprobar). El tiempo de espera es de 8 segundos porque la
primera consulta puede coincidir con el arranque de la máquina virtual de Java.

Los usuarios y los grupos de trabajo (HU-069) todavía no tienen catálogo, así que esos dos
tipos se aceptan sin comprobar; llegarán con esa historia.

## 7. El lienzo

Es SVG dibujado a mano dentro de React, sin librerías de diagramación y sin dependencias
nuevas: cada paso es un rectángulo, cada transición una línea con su flecha y su etiqueta, y
el sitio de cada paso se guarda en la base (`posicion_x`, `posicion_y`). Se puede arrastrar
un paso para ubicarlo, hacer clic para editarlo en el panel derecho, y el guardado ocurre al
soltar. Un lienzo con librería (React Flow y compañía) habría agregado entre 300 KB y 1 MB
al paquete del frontend; el paquete completo hoy pesa 367 KB.

## 8. Lo que queda deliberadamente por fuera

- **Versionado**: HU-078 crea versiones nuevas y HU-080 las lista con su fecha y autor; cualquier
  versión se consulta en solo lectura con `?version=N` y solo el borrador se edita. El
  borrador abierto sobre un flujo publicado se puede descartar; la primera versión no.
- **HU-069 (usuario, grupo o rol)**: falta el catálogo de usuarios y grupos para validar
  responsables.
- **HU-050 (guardia de trámites en curso)**: el backlog pide no archivar un flujo con
  documentos en tránsito; la tabla `tramite` nace con HU-062, así que hoy no hay nada que
  contar. El archivo se permite siempre y queda anotado en el código.
