import { peticion } from './cliente.js'

/** Administración de usuarios (HU-003 crear, HU-004 editar, HU-005 baja, HU-006 consultar). */

export function listarUsuarios(filtros = {}) {
  return peticion('/usuarios', { parametros: { tamano: 10, ...filtros } })
}

export function obtenerUsuario(id) {
  return peticion(`/usuarios/${id}`)
}

export function crearUsuario(datos) {
  return peticion('/usuarios', { metodo: 'POST', cuerpo: datos })
}

export function editarUsuario(id, datos) {
  return peticion(`/usuarios/${id}`, { metodo: 'PUT', cuerpo: datos })
}

export function darDeBajaUsuario(id) {
  return peticion(`/usuarios/${id}`, { metodo: 'DELETE' })
}

/** HU-012: el usuario debe conservar al menos un rol. */
export function asignarRolesUsuario(id, roles) {
  return peticion(`/usuarios/${id}/roles`, { metodo: 'PUT', cuerpo: { roles } })
}

export function cambiarClaveUsuario(id, clave) {
  return peticion(`/usuarios/${id}/clave`, { metodo: 'PUT', cuerpo: { clave } })
}
