import { BASE_DOCUMENTOS, descargar, peticion } from './cliente.js'

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

/**
 * Anexos del radicado (HU-025…HU-029).
 *
 * El archivo viaja como cuerpo binario y su nombre en la cabecera `X-Nombre-Archivo`:
 * el servicio no acepta multipart, así que se evita el parseo en los dos extremos.
 */
export function cargarAnexo(radicadoId, archivo) {
  return peticion(`/radicados/${radicadoId}/anexos`, {
    metodo: 'POST',
    base: BASE_DOCUMENTOS,
    crudo: archivo,
    cabeceras: {
      'Content-Type': archivo.type || 'application/octet-stream',
      'X-Nombre-Archivo': encodeURIComponent(archivo.name),
    },
  })
}

/** HU-027: anexos vigentes del radicado. */
export function listarAnexos(radicadoId) {
  return peticion(`/radicados/${radicadoId}/anexos`, { base: BASE_DOCUMENTOS })
}

/** HU-029: la eliminación exige un motivo y queda en el historial. */
export function eliminarAnexo(anexoId, motivo) {
  return peticion(`/anexos/${anexoId}`, { metodo: 'DELETE', cuerpo: { motivo }, base: BASE_DOCUMENTOS })
}

/** HU-028: descarga autenticada; devuelve el archivo y su nombre. */
export function descargarAnexo(anexoId) {
  return descargar(`/anexos/${anexoId}/descarga`, { base: BASE_DOCUMENTOS })
}

/**
 * HU-027: varios archivos en una sola petición. El servicio los recibe en JSON y en
 * base64, así que aquí se leen todos antes de enviarlos.
 */
export async function cargarAnexosEnLote(radicadoId, archivos) {
  const contenidos = await Promise.all(archivos.map(async (archivo) => ({
    nombre: archivo.name,
    tipoMime: archivo.type || 'application/octet-stream',
    contenido: await base64(archivo),
  })))
  return peticion(`/radicados/${radicadoId}/anexos/lote`, {
    metodo: 'POST',
    cuerpo: { archivos: contenidos },
    base: BASE_DOCUMENTOS,
  })
}

/** Convierte un archivo en base64 sin arrastrar el prefijo `data:` de la URL. */
function base64(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onerror = () => rechazar(new Error(`No se pudo leer ${archivo.name}.`))
    lector.onload = () => resolver(String(lector.result).split(',')[1] ?? '')
    lector.readAsDataURL(archivo)
  })
}

/** HU-041: enviar una copia informativa del radicado y ver a quién se envió. */
export function enviarCopia(radicadoId, datos) {
  return peticion(`/radicados/${radicadoId}/copias`, { metodo: 'POST', cuerpo: datos, base: BASE_DOCUMENTOS })
}

export function copiasEnviadas(radicadoId) {
  return peticion(`/radicados/${radicadoId}/copias`, { base: BASE_DOCUMENTOS })
}

/** HU-042: bandeja secundaria de quien recibe copias. */
export function bandejaDeCopias(filtros = {}) {
  return peticion('/copias', { parametros: filtros, base: BASE_DOCUMENTOS })
}

export function marcarCopiaLeida(id) {
  return peticion(`/copias/${id}/leer`, { metodo: 'POST', base: BASE_DOCUMENTOS })
}
