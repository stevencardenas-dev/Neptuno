import { guardarSesion, leerSesion, limpiarSesion, tokenActual } from './almacenSesion.js'

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

/** Evento con el que el cliente avisa que renovó los tokens y la sesión (roles y permisos). */
export const EVENTO_SESION_RENOVADA = 'neptuno:sesion-renovada'

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

/** Rutas de autenticación que nunca deben disparar la renovación automática. */
const RUTAS_SIN_RENOVACION = ['/auth/login', '/auth/refrescar', '/auth/logout']

// Renovación en curso: si varias peticiones reciben 401 a la vez, todas esperan la
// misma renovación en vez de gastar (y revocar) el token de refresco varias veces.
let renovacionEnCurso = null

/**
 * Cambia el token de refresco por un par nuevo (el servicio rota el refresco).
 * Devuelve true si la sesión quedó renovada.
 */
function renovarAcceso() {
  if (!renovacionEnCurso) {
    renovacionEnCurso = (async () => {
      const guardada = leerSesion()
      const refresco = guardada?.refresco?.token
      if (!refresco) return false
      try {
        const respuesta = await fetch(`${BASE}/auth/refrescar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresco }),
        })
        if (!respuesta.ok) return false
        const { acceso, refresco: nuevoRefresco } = await respuesta.json()

        // El servicio rechaza el acceso anterior también cuando cambian los roles o los
        // permisos del usuario (HU-013): se trae la sesión vigente para refrescar el menú.
        let sesion = guardada.sesion
        const actual = await fetch(`${BASE}/auth/sesion`, { headers: { Authorization: `Bearer ${acceso.token}` } })
        if (actual.ok) sesion = await actual.json()

        guardarSesion({ ...guardada, acceso, refresco: nuevoRefresco, sesion })
        window.dispatchEvent(new Event(EVENTO_SESION_RENOVADA))
        return true
      } catch {
        return false
      }
    })().finally(() => {
      renovacionEnCurso = null
    })
  }
  return renovacionEnCurso
}

function enviar(ruta, { metodo, cuerpo, parametros }) {
  const token = tokenActual()
  return fetch(conParametros(`${BASE}${ruta}`, parametros), {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
}

/**
 * Ejecuta una petición contra el servicio.
 *
 * Si el token de acceso venció, intenta renovarlo una vez con el token de refresco
 * y repite la petición; solo si eso falla la sesión se da por perdida.
 *
 * @param {string} ruta      ruta relativa al prefijo, p. ej. `/usuarios`
 * @param {object} opciones  `metodo`, `cuerpo` (se serializa a JSON) y `parametros`
 * @returns {Promise<any>}   cuerpo de la respuesta, o null si fue 204
 */
export async function peticion(ruta, { metodo = 'GET', cuerpo, parametros } = {}) {
  const opciones = { metodo, cuerpo, parametros }
  let respuesta = await enviar(ruta, opciones)

  if (respuesta.status === 401 && !RUTAS_SIN_RENOVACION.includes(ruta) && await renovarAcceso()) {
    respuesta = await enviar(ruta, opciones)
  }

  // Token vencido, revocado o inexistente y sin renovación posible: la sesión ya no sirve.
  if (respuesta.status === 401 && !RUTAS_SIN_RENOVACION.includes(ruta)) {
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
