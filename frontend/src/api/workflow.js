import { BASE_WORKFLOW, peticion } from './cliente.js'

/**
 * Diseñador de flujos de trabajo (ms-workflow-bpm).
 *
 * HU-048 crear un flujo · HU-051 consultarlo y buscarlo · HU-049 corregir su nombre y su
 * descripción. La definición (pasos, transiciones, responsables) y la publicación vienen
 * después, en el mismo archivo.
 */

/** HU-051: listado paginado, con búsqueda por texto y filtro por estado. */
export function listarFlujos(filtros = {}) {
  return peticion('/flujos', { parametros: filtros, base: BASE_WORKFLOW })
}

/** HU-051: detalle de un flujo. */
export function consultarFlujo(id) {
  return peticion(`/flujos/${id}`, { base: BASE_WORKFLOW })
}

/** HU-048: crear un flujo, que nace en borrador. */
export function crearFlujo(datos) {
  return peticion('/flujos', { metodo: 'POST', cuerpo: datos, base: BASE_WORKFLOW })
}

/** HU-049: editar el nombre o la descripción. */
export function editarFlujo(id, datos) {
  return peticion(`/flujos/${id}`, { metodo: 'PUT', cuerpo: datos, base: BASE_WORKFLOW })
}

/**
 * Definición del flujo: pasos, transiciones, responsables y publicación
 * (HU-050 y HU-052…HU-061). Todas devuelven el flujo dibujado otra vez, así que el lienzo
 * se refresca con una sola respuesta.
 */

/** HU-052: pasos, transiciones y sitio de cada paso en el lienzo. */
export function grafoFlujo(id) {
  return peticion(`/flujos/${id}/grafo`, { base: BASE_WORKFLOW })
}

/** HU-053: agregar un paso. */
export function agregarPaso(id, datos) {
  return peticion(`/flujos/${id}/estados`, { metodo: 'POST', cuerpo: datos, base: BASE_WORKFLOW })
}

/** HU-054: corregir el nombre, la descripción o el sitio del paso. */
export function editarPaso(id, pasoId, datos) {
  return peticion(`/flujos/${id}/estados/${pasoId}`, { metodo: 'PUT', cuerpo: datos, base: BASE_WORKFLOW })
}

/** HU-055: marcar el paso como inicial, intermedio o final. */
export function marcarPaso(id, pasoId, tipo) {
  return peticion(`/flujos/${id}/estados/${pasoId}/tipo`, { metodo: 'PATCH', cuerpo: { tipo }, base: BASE_WORKFLOW })
}

/** HU-054: retirar un paso del flujo. */
export function retirarPaso(id, pasoId) {
  return peticion(`/flujos/${id}/estados/${pasoId}`, { metodo: 'DELETE', base: BASE_WORKFLOW })
}

/** HU-056: crear una transición (acción + origen → destino). */
export function agregarTransicion(id, datos) {
  return peticion(`/flujos/${id}/transiciones`, { metodo: 'POST', cuerpo: datos, base: BASE_WORKFLOW })
}

/** HU-057: editar una transición. */
export function editarTransicion(id, transicionId, datos) {
  return peticion(`/flujos/${id}/transiciones/${transicionId}`, { metodo: 'PUT', cuerpo: datos, base: BASE_WORKFLOW })
}

/** HU-058: eliminar una transición. */
export function retirarTransicion(id, transicionId) {
  return peticion(`/flujos/${id}/transiciones/${transicionId}`, { metodo: 'DELETE', base: BASE_WORKFLOW })
}

/** HU-059: asignar un rol, un área, un usuario o un grupo al paso. */
export function asignarResponsable(id, pasoId, datos) {
  return peticion(`/flujos/${id}/estados/${pasoId}/responsables`, { metodo: 'POST', cuerpo: datos, base: BASE_WORKFLOW })
}

/** HU-060: quitar un responsable del paso. */
export function quitarResponsable(id, pasoId, responsableId) {
  return peticion(`/flujos/${id}/estados/${pasoId}/responsables/${responsableId}`, { metodo: 'DELETE', base: BASE_WORKFLOW })
}

/** HU-061: publicar el flujo. */
export function publicarFlujo(id) {
  return peticion(`/flujos/${id}/publicar`, { metodo: 'POST', base: BASE_WORKFLOW })
}

/** HU-050: archivar el flujo. */
export function desactivarFlujo(id) {
  return peticion(`/flujos/${id}/desactivar`, { metodo: 'PATCH', base: BASE_WORKFLOW })
}

/** HU-050: devolver el flujo a la operación. */
export function reactivarFlujo(id) {
  return peticion(`/flujos/${id}/reactivar`, { metodo: 'PATCH', base: BASE_WORKFLOW })
}

/**
 * Trámites y bandeja de entrada (HU-062…HU-074).
 *
 * Un trámite es un radicado recorriendo un flujo publicado. La bandeja devuelve solo las
 * tareas del paso en el que el usuario es responsable; quien administra flujos las ve todas.
 */

/** HU-062: flujos publicados a los que se puede enviar un radicado. */
export function listarFlujosPublicados() {
  return peticion('/flujos-publicados', { base: BASE_WORKFLOW })
}

/** HU-062: abrir el trámite; el radicado queda en el paso inicial. */
export function iniciarTramite(datos) {
  return peticion('/tramites', { metodo: 'POST', cuerpo: datos, base: BASE_WORKFLOW })
}

/** El trámite que tiene un radicado, si alguno. */
export function tramiteDeRadicado(radicadoId) {
  return peticion(`/tramites/radicado/${radicadoId}`, { base: BASE_WORKFLOW })
}
