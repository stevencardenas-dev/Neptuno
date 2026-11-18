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

/**
 * Expediente central (HU-030…HU-034): árbol de carpetas por área, subcarpetas,
 * visibilidad por rol o área y documentos No radicables.
 */

/** HU-032, HU-033: el árbol que la sesión puede ver. */
export function arbolExpediente() {
  return peticion('/expediente/arbol', { base: BASE_DOCUMENTOS })
}

/** HU-030, HU-031: crear la carpeta raíz de un área o una subcarpeta. */
export function crearCarpeta(datos) {
  return peticion('/expediente/carpetas', { metodo: 'POST', cuerpo: datos, base: BASE_DOCUMENTOS })
}

/** HU-031: renombrar o cambiar el tipo de expediente. */
export function editarCarpeta(id, datos) {
  return peticion(`/expediente/carpetas/${id}`, { metodo: 'PUT', cuerpo: datos, base: BASE_DOCUMENTOS })
}

/** HU-030: desactivar una carpeta vacía. */
export function desactivarCarpeta(id) {
  return peticion(`/expediente/carpetas/${id}`, { metodo: 'DELETE', base: BASE_DOCUMENTOS })
}

/** HU-033: accesos heredables por rol o área. */
export function accesosDeCarpeta(id) {
  return peticion(`/expediente/carpetas/${id}/accesos`, { base: BASE_DOCUMENTOS })
}

export function reemplazarAccesosDeCarpeta(id, accesos) {
  return peticion(`/expediente/carpetas/${id}/accesos`, {
    metodo: 'PUT', cuerpo: { accesos }, base: BASE_DOCUMENTOS,
  })
}

/** HU-034: documentos No radicables de una carpeta. */
export function documentosDeCarpeta(id) {
  return peticion(`/expediente/carpetas/${id}/documentos`, { base: BASE_DOCUMENTOS })
}

export function crearDocumentoDeExpediente(carpetaId, datos) {
  return peticion(`/expediente/carpetas/${carpetaId}/documentos`, {
    metodo: 'POST', cuerpo: datos, base: BASE_DOCUMENTOS,
  })
}

/** HU-034: archivos de un documento No radicable. */
export function anexosDeDocumentoExpediente(documentoId) {
  return peticion(`/documentos-expediente/${documentoId}/anexos`, { base: BASE_DOCUMENTOS })
}

export function cargarAnexoDeExpediente(documentoId, archivo) {
  return peticion(`/documentos-expediente/${documentoId}/anexos`, {
    metodo: 'POST',
    base: BASE_DOCUMENTOS,
    crudo: archivo,
    cabeceras: {
      'Content-Type': archivo.type || 'application/octet-stream',
      'X-Nombre-Archivo': encodeURIComponent(archivo.name),
    },
  })
}

/**
 * Plantillas DOCX (HU-035…HU-038). El archivo viaja como cuerpo binario y los
 * metadatos en cabeceras `X-*`, igual que los anexos.
 */
export function listarPlantillas() {
  return peticion('/plantillas', { base: BASE_DOCUMENTOS })
}

export function obtenerPlantilla(id) {
  return peticion(`/plantillas/${id}`, { base: BASE_DOCUMENTOS })
}

/** HU-035: subir el DOCX; el servicio detecta sus marcadores `{{campo}}`. */
export function subirPlantilla(archivo, metadatos = {}) {
  const cabeceras = {
    'Content-Type': archivo.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'X-Nombre-Archivo': encodeURIComponent(archivo.name),
  }
  if (metadatos.nombre) cabeceras['X-Nombre-Plantilla'] = encodeURIComponent(metadatos.nombre)
  if (metadatos.descripcion) cabeceras['X-Descripcion-Plantilla'] = encodeURIComponent(metadatos.descripcion)
  if (metadatos.origenes?.length) cabeceras['X-Origenes'] = metadatos.origenes.join(',')
  return peticion('/plantillas', { metodo: 'POST', base: BASE_DOCUMENTOS, crudo: archivo, cabeceras })
}

/** HU-035: nombre, descripción y estado. */
export function editarPlantilla(id, datos) {
  return peticion(`/plantillas/${id}`, { metodo: 'PUT', cuerpo: datos, base: BASE_DOCUMENTOS })
}

/** HU-036: variables y el campo del radicado que precarga cada una. */
export function reemplazarVariablesDePlantilla(id, variables) {
  return peticion(`/plantillas/${id}/variables`, { metodo: 'PUT', cuerpo: { variables }, base: BASE_DOCUMENTOS })
}

/** HU-036: orígenes Interno / Externo con los que se puede usar. */
export function reemplazarOrigenesDePlantilla(id, origenes) {
  return peticion(`/plantillas/${id}/origenes`, { metodo: 'PUT', cuerpo: { origenes }, base: BASE_DOCUMENTOS })
}

/** HU-037, HU-038: generar DOCX y PDF y anexarlos al radicado. */
export function generarDesdePlantilla(radicadoId, datos) {
  return peticion(`/radicados/${radicadoId}/documentos-generados`, {
    metodo: 'POST', cuerpo: datos, base: BASE_DOCUMENTOS,
  })
}

export function documentosGenerados(radicadoId) {
  return peticion(`/radicados/${radicadoId}/documentos-generados`, { base: BASE_DOCUMENTOS })
}

/** Copias informativas (HU-041, HU-042). */
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
