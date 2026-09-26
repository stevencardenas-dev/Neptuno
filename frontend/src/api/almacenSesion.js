/**
 * Persistencia de la sesión del frontend.
 *
 * Guarda el par de tokens (acceso y refresco) junto con la sesión que devuelve
 * ms-auth-catalogs en el inicio de sesión: nombre, área, rol principal y permisos.
 * El token de acceso es lo único que el servicio necesita para autenticar cada
 * solicitud posterior (HU-001) y su vigencia es de 30 minutos.
 */
const CLAVE = 'neptuno.sesion'

/** Sesión guardada, o null si no hay ninguna. */
export function leerSesion() {
  try {
    const crudo = window.localStorage.getItem(CLAVE)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    // Si el contenido quedó corrupto se descarta en vez de romper la aplicación.
    window.localStorage.removeItem(CLAVE)
    return null
  }
}

export function guardarSesion(sesion) {
  window.localStorage.setItem(CLAVE, JSON.stringify(sesion))
}

export function limpiarSesion() {
  window.localStorage.removeItem(CLAVE)
}

/** Token de acceso vigente, o null si no hay sesión. */
export function tokenActual() {
  return leerSesion()?.acceso?.token ?? null
}
