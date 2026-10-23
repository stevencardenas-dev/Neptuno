import { ErrorApi, prohibido } from '../errores';

/**
 * Cliente de los catálogos de servicio-usuarios, con el mismo patrón que usa
 * servicio-documentos: la consulta viaja con el token del propio administrador, así que
 * se valida con sus permisos y no hace falta una clave de servicio.
 *
 * HU-059 pide validar contra ms-auth-catalogs los roles y las áreas que se asignan a un
 * paso. El tiempo de espera es de 8 segundos porque la primera consulta puede encontrar
 * la máquina virtual de Java arrancando (ya pasó con la radicación).
 */
export interface Catalogo {
  rol(id: string, token: string): Promise<{ id: string; nombre: string } | null>;
  area(id: string, token: string): Promise<{ id: string; nombre: string } | null>;
  /** Un usuario inactivo o dado de baja cuenta como inexistente: no puede atender pasos. */
  usuario(id: string, token: string): Promise<{ id: string; nombre: string } | null>;
}

const ESPERA_MS = 8000;

export function crearClienteCatalogos(baseUrl: string): Catalogo {
  async function leer(ruta: string, token: string): Promise<any> {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${baseUrl}/api/usuarios${ruta}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(ESPERA_MS),
      });
    } catch {
      throw new ErrorApi(503, 'SERVICIO_NO_DISPONIBLE', 'No se pudo consultar el catálogo de usuarios.');
    }
    if (respuesta.status === 404) return null;
    if (respuesta.status === 403) throw prohibido('Necesitas el permiso catalogos:consultar (y usuarios:consultar para asignar personas) para validar el catálogo.');
    if (!respuesta.ok) throw new ErrorApi(502, 'CATALOGO_ERROR', 'El catálogo de usuarios respondió con un error.');
    return respuesta.json();
  }

  return {
    rol: (id, token) => leer(`/roles/${id}`, token),
    area: (id, token) => leer(`/areas/${id}`, token),
    usuario: async (id, token) => {
      const usuario = await leer(`/usuarios/${id}`, token);
      return usuario && !usuario.eliminadoEn && usuario.estado !== 'INACTIVO' ? usuario : null;
    },
  };
}
