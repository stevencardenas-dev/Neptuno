import { guardarSesion, leerSesion, limpiarSesion, tokenActual } from './almacenSesion.js'

/**
 * Cliente HTTP del frontend hacia los microservicios.
 *
 * Todas las llamadas salen por el mismo origen y solo cambia el prefijo: en
 * desarrollo lo resuelve el proxy de Vite y en contenedores nginx, así que no hay
 * URLs absolutas que mantener ni problemas de CORS. La renovación del token se pide
 * siempre al servicio de usuarios, que es el que emite la sesión.
 */
const BASE = '/api/usuarios'

/** Prefijo del servicio de documentos (radicación), que comparte sesión y cliente. */
export const BASE_DOCUMENTOS = '/api/documentos'

/** Prefijo del servicio de auditoría (bitácora), que comparte sesión y cliente. */
export const BASE_AUDITORIA = '/api/auditoria'

/** Prefijo del servicio de flujos de trabajo, que comparte sesión y cliente. */
export const BASE_WORKFLOW = '/api/workflow'

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

function enviar(ruta, { metodo, cuerpo, parametros, base = BASE, crudo, cabeceras = {} }) {
  const token = tokenActual()
  return fetch(conParametros(`${base}${ruta}`, parametros), {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...cabeceras,
    },
    // `crudo` es el archivo tal cual (un Blob): los anexos viajan como cuerpo binario.
    body: crudo ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
  })
}

/**
 * Ejecuta una petición contra el servicio.
 *
 * Si el token de acceso venció, intenta renovarlo una vez con el token de refresco
 * y repite la petición; solo si eso falla la sesión se da por perdida.
 *
 * @param {string} ruta      ruta relativa al prefijo, p. ej. `/usuarios`
 * @param {object} opciones  `metodo`, `cuerpo` (se serializa a JSON), `parametros`,
 *                           `crudo` (un Blob que viaja como cuerpo tal cual),
 *                           `cabeceras` extra y `base` (prefijo del servicio)
 * @returns {Promise<any>}   cuerpo de la respuesta, o null si fue 204
 */
export async function peticion(ruta, { metodo = 'GET', cuerpo, parametros, base = BASE, crudo, cabeceras } = {}) {
  const opciones = { metodo, cuerpo, parametros, base, crudo, cabeceras }
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
  // Algunas rutas responden JSON vacío (`null` o cuerpo en blanco): se tolera y se
  // entrega null en vez de romper la vista con un error de lectura.
  const datos = tipo.includes('application/json')
    ? await respuesta.json().catch(() => null)
    : null

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

/** Nombre del archivo que anuncia la respuesta, con el `filename*` (UTF-8) primero. */
function nombreDe(respuesta) {
  const cabecera = respuesta.headers.get('content-disposition') ?? ''
  const extendido = /filename\*=UTF-8''([^;]+)/i.exec(cabecera)
  if (extendido) {
    try {
      return decodeURIComponent(extendido[1])
    } catch {
      /* el nombre venía mal codificado: se prueba con el simple */
    }
  }
  const simple = /filename="?([^";]+)"?/i.exec(cabecera)
  return simple ? simple[1] : 'anexo'
}

/**
 * Descarga un archivo del servicio y lo entrega como Blob, renovando el token si hace
 * falta (mismo criterio que `peticion`, que solo sabe leer JSON).
 */
export async function descargar(ruta, { base = BASE } = {}) {
  const opciones = { metodo: 'GET', base }
  let respuesta = await enviar(ruta, opciones)

  if (respuesta.status === 401 && await renovarAcceso()) {
    respuesta = await enviar(ruta, opciones)
  }
  if (respuesta.status === 401) {
    limpiarSesion()
    window.dispatchEvent(new Event(EVENTO_SESION_PERDIDA))
  }
  if (!respuesta.ok) {
    throw new ErrorApi({
      estado: respuesta.status,
      codigo: 'DESCARGA',
      mensaje: 'No se pudo descargar el archivo.',
    })
  }

  return { blob: await respuesta.blob(), nombre: nombreDe(respuesta) }
}
