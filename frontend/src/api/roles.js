import { peticion } from './cliente.js'

/** Roles y permisos (HU-007 crear, HU-008 editar, HU-009 eliminar, HU-010 consultar, HU-011 asignar permisos). */

export function listarRoles() {
  return peticion('/roles')
}

export function obtenerRol(id) {
  return peticion(`/roles/${id}`)
}

export function usuariosDelRol(id) {
  return peticion(`/roles/${id}/usuarios`)
}

export function crearRol(datos) {
  return peticion('/roles', { metodo: 'POST', cuerpo: datos })
}

export function editarRol(id, datos) {
  return peticion(`/roles/${id}`, { metodo: 'PUT', cuerpo: datos })
}

export function eliminarRol(id) {
  return peticion(`/roles/${id}`, { metodo: 'DELETE' })
}

export function asignarPermisosRol(id, permisos) {
  return peticion(`/roles/${id}/permisos`, { metodo: 'PUT', cuerpo: { permisos } })
}

/** Catálogo de permisos agrupado por módulo, fuente de la vista de asignación. */
export function catalogoPermisos() {
  return peticion('/permisos')
}
