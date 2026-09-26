import { limpiarSesion, tokenActual } from './almacenSesion.js'

/**
 * Cliente HTTP del frontend hacia el servicio de usuarios (ms-auth-catalogs).
 *
 * Todas las llamadas salen por el mismo origen con el prefijo `/api/usuarios`:
 * en desarrollo lo resuelve el proxy de Vite y en contenedores nginx, así que no
 * hay URLs absolutas que mantener ni problemas de CORS.
 */
const BASE = '/api/usuarios'

/** Evento con el que el cliente avisa que el token dejó de servir (401). */
export const EVENTO_SESION_PERDIDA = 'neptuno:sesion-perdida'

/** Error uniforme del API: conserva el código, el mensaje y los detalles del servicio. */
export class ErrorApi extends Error {
  constructor({ codigo, mensaje, detalles, estado }) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.codigo = codigo
    this.detalles = detalles ?? []
    this.estado = estado
  }
}

function conParametros(ruta, parametros = {}) {
  const utiles = Object.entries(parametros).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
  if (!utiles.length) return ruta
  return `${ruta}?${new URLSearchParams(utiles.map(([clave, valor]) => [clave, String(valor)]))}`
}

/**
 * Ejecuta una petición contra el servicio.
 *
 * @param {string} ruta      ruta relativa al prefijo, p. ej. `/usuarios`
 * @param {object} opciones  `metodo`, `cuerpo` (se serializa a JSON) y `parametros`
 * @returns {Promise<any>}   cuerpo de la respuesta, o null si fue 204
 */
export async function peticion(ruta, { metodo = 'GET', cuerpo, parametros } = {}) {
  const token = tokenActual()

  const respuesta = await fetch(conParametros(`${BASE}${ruta}`, parametros), {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })

  // Token vencido, revocado o inexistente: la sesión del navegador ya no sirve.
  if (respuesta.status === 401) {
    limpiarSesion()
    window.dispatchEvent(new Event(EVENTO_SESION_PERDIDA))
  }

  if (respuesta.status === 204) return null

  const tipo = respuesta.headers.get('content-type') ?? ''
  const datos = tipo.includes('application/json') ? await respuesta.json() : null

  if (!respuesta.ok) {
    throw new ErrorApi({
      estado: respuesta.status,
      codigo: datos?.codigo ?? 'ERROR',
      mensaje: datos?.mensaje ?? 'El servicio no respondió como se esperaba.',
      detalles: datos?.detalles,
    })
  }

  return datos
}
