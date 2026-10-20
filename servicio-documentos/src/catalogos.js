import { ErrorApi, prohibido } from './errores.js';

// Cliente de los catálogos maestros de servicio-usuarios. Reenvía el token del usuario,
// de modo que la consulta se hace con sus propios permisos (catalogos:consultar).
//
// La espera es de 8 segundos a propósito: la primera consulta puede coincidir con el
// arranque de la máquina virtual de Java y, con 5 segundos, una radicación recién iniciada
// la sesión fallaba por catálogo lento en lugar de por datos.
export function crearClienteCatalogos(baseUrl) {
  async function leer(ruta, token) {
    let respuesta;
    try {
      respuesta = await fetch(`${baseUrl}/api/usuarios${ruta}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ErrorApi(503, 'SERVICIO_NO_DISPONIBLE', 'No se pudo consultar el catálogo de servicio-usuarios.');
    }
    if (respuesta.status === 404) return null;
    if (respuesta.status === 403) throw prohibido('Necesitas el permiso catalogos:consultar para validar los catálogos.');
    if (!respuesta.ok) throw new ErrorApi(502, 'CATALOGO_ERROR', 'servicio-usuarios respondió con un error al validar el catálogo.');
    return respuesta.json();
  }

  return {
    tipoDocumental: (id, token) => leer(`/tipos-documentales/${id}`, token),
    area: (id, token) => leer(`/areas/${id}`, token),
    entidad: (id, token) => leer(`/entidades/${id}`, token),
  };
}
