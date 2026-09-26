/** Utilidades de presentación compartidas por las vistas conectadas al API. */

/** Fecha y hora legibles; null se muestra como "Sin ingreso". */
export function formatearFecha(iso) {
  if (!iso) return 'Sin ingreso'
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
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

/** Iniciales para el avatar a partir del nombre completo. */
export function iniciales(nombre = '') {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0].toUpperCase()).join('')
}
