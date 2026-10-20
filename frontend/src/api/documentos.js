import { BASE_DOCUMENTOS, peticion } from './cliente.js'

/**
 * Radicación de documentos (ms-document-management).
 *
 * HU-017 código único e inmutable · HU-018 clasificación por origen · HU-019 y
 * HU-039 metadatos · HU-020 detalle · HU-021 edición sin tocar el código ·
 * HU-023 listado filtrable · HU-024 origen Recibido · HU-040 clase Original/Copia.
 */

/** HU-023: listado paginado. Los filtros vacíos se descartan en el cliente HTTP. */
export function listarRadicados(filtros = {}) {
  return peticion('/radicados', { parametros: filtros, base: BASE_DOCUMENTOS })
}

/** HU-020 */
export function obtenerRadicado(id) {
  return peticion(`/radicados/${id}`, { base: BASE_DOCUMENTOS })
}

/** HU-017: el código lo asigna el servicio; el cliente nunca lo envía. */
export function crearRadicado(datos) {
  return peticion('/radicados', { metodo: 'POST', cuerpo: datos, base: BASE_DOCUMENTOS })
}

/** HU-021: la `version` viaja en el cuerpo para detectar ediciones simultáneas. */
export function editarRadicado(id, datos) {
  return peticion(`/radicados/${id}`, { metodo: 'PUT', cuerpo: datos, base: BASE_DOCUMENTOS })
}
