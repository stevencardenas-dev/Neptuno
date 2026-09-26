import { peticion } from './cliente.js'

/**
 * Catálogos maestros (HU-015 tipos documentales, HU-016 áreas, HU-022 entidades).
 * Los registros se desactivan, nunca se borran, para no invalidar los radicados históricos.
 */

/* --------------------------------- Áreas --------------------------------- */

export function listarAreas(filtros = {}) {
  return peticion('/areas', { parametros: filtros })
}

export function crearArea(datos) {
  return peticion('/areas', { metodo: 'POST', cuerpo: datos })
}

export function editarArea(id, datos) {
  return peticion(`/areas/${id}`, { metodo: 'PUT', cuerpo: datos })
}

export function desactivarArea(id) {
  return peticion(`/areas/${id}`, { metodo: 'DELETE' })
}

/* --------------------------- Tipos documentales -------------------------- */

export function listarTiposDocumentales(filtros = {}) {
  return peticion('/tipos-documentales', { parametros: filtros })
}

export function crearTipoDocumental(datos) {
  return peticion('/tipos-documentales', { metodo: 'POST', cuerpo: datos })
}

export function editarTipoDocumental(id, datos) {
  return peticion(`/tipos-documentales/${id}`, { metodo: 'PUT', cuerpo: datos })
}

export function desactivarTipoDocumental(id) {
  return peticion(`/tipos-documentales/${id}`, { metodo: 'DELETE' })
}

/* ------------------------------- Entidades ------------------------------- */

export function listarEntidades(filtros = {}) {
  return peticion('/entidades', { parametros: filtros })
}

export function crearEntidad(datos) {
  return peticion('/entidades', { metodo: 'POST', cuerpo: datos })
}

export function editarEntidad(id, datos) {
  return peticion(`/entidades/${id}`, { metodo: 'PUT', cuerpo: datos })
}

export function desactivarEntidad(id) {
  return peticion(`/entidades/${id}`, { metodo: 'DELETE' })
}

/* -------------------------------- Orígenes ------------------------------- */

/** Dígitos del formato de radicado AAAAMMDD + X + CONSECUTIVO. */
export function listarOrigenes() {
  return peticion('/catalogos/origenes')
}
