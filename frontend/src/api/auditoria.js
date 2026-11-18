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

/**
 * Respaldos, restauración y rendimiento (HU-081, HU-082, HU-084, HU-085).
 *
 * La programación de copias y la restauración son operaciones de administración; el
 * rendimiento se consulta con su propio permiso.
 */

/** HU-081: la copia programada vigente. */
export function programacionDeRespaldos() {
  return peticion('/respaldos/programacion', { base: BASE_AUDITORIA })
}

/** HU-081: frecuencia, hora, retención y alcance de la copia. */
export function guardarProgramacionDeRespaldos(datos) {
  return peticion('/respaldos/programacion', { metodo: 'PUT', cuerpo: datos, base: BASE_AUDITORIA })
}

/** HU-081: ejecuciones, de la más reciente a la más antigua. */
export function listarRespaldos(limite = 25) {
  return peticion('/respaldos', { parametros: { limite }, base: BASE_AUDITORIA })
}

/** HU-081: lanzar una copia ahora. */
export function ejecutarRespaldo() {
  return peticion('/respaldos', { metodo: 'POST', base: BASE_AUDITORIA })
}

/** HU-082: solicitar una restauración; queda pendiente de que otra persona la confirme. */
export function solicitarRestauracion(respaldoId, motivo) {
  return peticion('/restauraciones', { metodo: 'POST', cuerpo: { respaldoId, motivo }, base: BASE_AUDITORIA })
}

/** HU-082: solicitudes de restauración. */
export function listarRestauraciones(limite = 25) {
  return peticion('/restauraciones', { parametros: { limite }, base: BASE_AUDITORIA })
}

/** HU-082: confirmar y ejecutar una restauración solicitada. */
export function ejecutarRestauracion(id) {
  return peticion(`/restauraciones/${id}/ejecutar`, { metodo: 'POST', base: BASE_AUDITORIA })
}

/** HU-084: percentiles vivos de este proceso frente al límite de 2 s. */
export function resumenRendimiento() {
  return peticion('/rendimiento', { base: BASE_AUDITORIA })
}

/** HU-084: guardar la ventana actual para compararla después. */
export function capturarRendimiento() {
  return peticion('/rendimiento/capturas', { metodo: 'POST', base: BASE_AUDITORIA })
}

/** HU-084: capturas guardadas. */
export function listarCapturasDeRendimiento(limite = 50) {
  return peticion('/rendimiento/capturas', { parametros: { limite }, base: BASE_AUDITORIA })
}

/** HU-085: pruebas de carga ejecutadas y su resultado. */
export function listarPruebasDeCarga(limite = 25) {
  return peticion('/rendimiento/pruebas-carga', { parametros: { limite }, base: BASE_AUDITORIA })
}
