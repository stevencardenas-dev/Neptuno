import { peticion } from './cliente.js'

/**
 * Endpoints de autenticación y sesión (HU-001 iniciar sesión, HU-002 cerrar sesión).
 * La renovación con el token de refresco la hace `cliente.js` de forma automática.
 */
export function iniciarSesion(correo, clave) {
  return peticion('/auth/login', { metodo: 'POST', cuerpo: { correo, clave } })
}

export function sesionActual() {
  return peticion('/auth/sesion')
}

export function cerrarSesion(refresco) {
  return peticion('/auth/logout', { metodo: 'POST', cuerpo: refresco ? { refresco } : undefined })
}
