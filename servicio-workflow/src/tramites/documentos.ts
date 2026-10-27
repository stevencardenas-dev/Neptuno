import { ErrorApi, conflicto, noEncontrado } from '../errores';

/**
 * Cliente de servicio-documentos (API interna con `X-Servicio-Clave`).
 *
 * El workflow no es dueño del radicado: al iniciar un trámite pide su resumen para la
 * bandeja y avisa del cambio de estado. Si documentos no responde, el trámite no se abre
 * (no tendría sentido abrir un trámite sobre un radicado que no existe).
 */
export interface ResumenRadicado {
  id: string;
  codigo: string;
  asunto: string;
  estado: string;
  tipoDocumentalId: string;
  origen: string;
  areaId: string;
  radicadoPor: string;
}

export interface ClienteDocumentos {
  radicado(id: string): Promise<ResumenRadicado>;
  marcarEstado(id: string, estado: 'EN_TRAMITE' | 'FINALIZADO' | 'RADICADO'): Promise<void>;
}

export const DOCUMENTOS = 'DOCUMENTOS';

const ESPERA_MS = 8000;

export function crearClienteDocumentos({ url, clave }: { url: string; clave: string }): ClienteDocumentos {
  async function llamar(ruta: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(`${url}/api/documentos/interno${ruta}`, {
        ...init,
        headers: {
          'X-Servicio-Clave': clave,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        signal: AbortSignal.timeout(ESPERA_MS),
      });
    } catch {
      throw new ErrorApi(503, 'SERVICIO_NO_DISPONIBLE', 'No se pudo consultar el servicio de documentos.');
    }
  }

  return {
    async radicado(id) {
      const respuesta = await llamar(`/radicados/${id}`);
      if (respuesta.status === 404) throw noEncontrado('El radicado no existe.');
      if (!respuesta.ok) throw new ErrorApi(502, 'DOCUMENTOS_ERROR', 'El servicio de documentos respondió con un error.');
      return (await respuesta.json()) as ResumenRadicado;
    },

    async marcarEstado(id, estado) {
      const respuesta = await llamar(`/radicados/${id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      });
      if (respuesta.status === 404) throw noEncontrado('El radicado no existe.');
      if (respuesta.status === 400 || respuesta.status === 409) {
        throw conflicto('El radicado no admite el cambio de estado que pide el trámite.');
      }
      if (!respuesta.ok) throw new ErrorApi(502, 'DOCUMENTOS_ERROR', 'No se pudo actualizar el estado del radicado.');
    },
  };
}
