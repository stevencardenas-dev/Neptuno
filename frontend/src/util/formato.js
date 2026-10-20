/** Utilidades de presentación compartidas por las vistas conectadas al API. */

/** Fecha y hora legibles; null se muestra como "Sin ingreso". */
export function formatearFecha(iso) {
  if (!iso) return 'Sin ingreso'
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

/** Fecha con hora para los hechos de auditoría: «17 oct 2026, 5:42 p. m.».
 *  El año completo importa cuando un registro se cita en un informe meses después. */
export function formatearFechaHora(iso) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  const dia = fecha
    .toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ de /g, ' ')
  return `${dia}, ${fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`
}

/** Etiqueta del estado de un usuario a partir del enum del servicio. */
export function etiquetaEstadoUsuario(usuario) {
  return usuario.estadoEtiqueta ?? (usuario.estado === 'ACTIVO' ? 'Activo' : 'Inactivo')
}

/** Etiqueta del estado de un registro de catálogo. */
export function etiquetaEstadoCatalogo(registro) {
  return registro.estadoEtiqueta ?? (registro.estado === 'ACTIVO' ? 'Activo' : 'Inactivo')
}

/** Orígenes del formato de radicado AAAAMMDD + X + CONSECUTIVO. */
export const ORIGENES = [
  { valor: 'INTERNO', etiqueta: 'Interno' },
  { valor: 'EXTERNO', etiqueta: 'Externo' },
  { valor: 'RECIBIDO', etiqueta: 'Recibido' },
  { valor: 'NO_RADICABLE', etiqueta: 'No radicable' },
]

export function etiquetaOrigen(valor) {
  return ORIGENES.find((origen) => origen.valor === valor)?.etiqueta ?? valor
}

/** Tipos de rol que admite el servicio (HU-007). */
export const TIPOS_ROL = [
  { valor: 'OPERATIVO', etiqueta: 'Operativo' },
  { valor: 'APROBADOR', etiqueta: 'Aprobador' },
  { valor: 'CONTROL', etiqueta: 'Control' },
  { valor: 'SISTEMA', etiqueta: 'Sistema' },
]

export function etiquetaTipoRol(rol) {
  return rol.tipoEtiqueta ?? TIPOS_ROL.find((tipo) => tipo.valor === rol.tipo)?.etiqueta ?? rol.tipo
}

/** Iniciales para el avatar a partir del nombre completo. Con una sola palabra se usan
 *  sus dos primeras letras: «Administrador» y «Auditor» no pueden compartir la «A». */
export function iniciales(nombre = '') {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return ''
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return `${partes[0][0]}${partes[1][0]}`.toUpperCase()
}

/* ----------------------------- Radicación (HU-017…) ----------------------------- */

/** Orígenes que se radican; NO_RADICABLE es del expediente, no de radicación. */
export const ORIGENES_RADICABLES = ORIGENES.filter((origen) => origen.valor !== 'NO_RADICABLE')

/** Clase del documento: el Original manda y las copias se reparten (HU-040). */
export const CLASES = [
  { valor: 'ORIGINAL', etiqueta: 'Original' },
  { valor: 'COPIA', etiqueta: 'Copia' },
]

export function etiquetaClase(valor) {
  return CLASES.find((clase) => clase.valor === valor)?.etiqueta ?? valor
}

/** Ciclo de vida del radicado. */
export const ESTADOS_RADICADO = [
  { valor: 'RADICADO', etiqueta: 'Radicado' },
  { valor: 'EN_TRAMITE', etiqueta: 'En trámite' },
  { valor: 'FINALIZADO', etiqueta: 'Finalizado' },
  { valor: 'ANULADO', etiqueta: 'Anulado' },
]

export function etiquetaEstadoRadicado(valor) {
  return ESTADOS_RADICADO.find((estado) => estado.valor === valor)?.etiqueta ?? valor
}

/**
 * El servicio devuelve la fecha del documento como AAAA-MM-DD o como instante ISO.
 * Se toma el día tal como quedó escrito para que ninguna zona horaria lo corra.
 */
export function soloDia(fecha) {
  const dia = String(fecha ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : ''
}

/** Fecha del documento en formato largo y sin hora. */
export function formatearDia(fecha) {
  const dia = soloDia(fecha)
  if (!dia) return '—'
  const [anio, mes, diaMes] = dia.split('-')
  return new Date(Number(anio), Number(mes) - 1, Number(diaMes))
    .toLocaleDateString('es-CO', { dateStyle: 'long' })
}

/** Hoy en AAAA-MM-DD según el reloj del navegador, para el tope del selector. */
export function hoyLocal() {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}
