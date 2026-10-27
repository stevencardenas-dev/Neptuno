/**
 * Utilidades de archivos para el navegador.
 *
 * El API entrega los anexos como Blob (la descarga va con el token de la sesión, así
 * que no puede ser un enlace directo). Estas dos funciones los muestran y los guardan.
 */

/** Tamaño en la unidad más cómoda de leer: 12 KB, 3,4 MB. */
export function tamanoLegible(bytes) {
  const numero = Number(bytes) || 0
  if (numero < 1024) return `${numero} B`
  if (numero < 1024 * 1024) return `${Math.round(numero / 1024)} KB`
  return `${(numero / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Guarda un Blob con el nombre indicado, sin dejar el objeto temporal en memoria. */
export function guardarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre || 'anexo'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  // El navegador necesita el objeto vivo hasta que empieza la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
