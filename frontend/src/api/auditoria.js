import { BASE_AUDITORIA, peticion } from './cliente.js'

/**
 * Bitácora inalterable del sistema (ms-audit-infra).
 *
 * HU-043 los eventos que publican los demás servicios se encadenan por hash ·
 * HU-044 la cadena se puede comprobar en cualquier momento · HU-046 consulta e
 * historial de un documento · HU-047 filtros por servicio, acción, entidad, actor y
 * rango de fechas.
 */

/** HU-046 y HU-047: listado paginado y filtrable. */
export function listarBitacora(filtros = {}) {
  return peticion('/bitacora', { parametros: filtros, base: BASE_AUDITORIA })
}

/** HU-046: hechos registrados sobre un documento concreto. */
export function historialDeRadicado(radicadoId) {
  return peticion(`/bitacora/radicado/${radicadoId}`, { base: BASE_AUDITORIA })
}

/** HU-044: recorre la cadena entera y dice si sigue íntegra. */
export function verificarCadena() {
  return peticion('/bitacora/verificacion', { base: BASE_AUDITORIA })
}

/** Valores que hoy existen en la bitácora, para armar los filtros con datos reales. */
export function facetasBitacora() {
  return peticion('/bitacora/facetas', { base: BASE_AUDITORIA })
}
