import { ErrorApi, prohibido, reglaInvalida } from './errores.js';

// Cliente de servicio-workflow. Reenvía el token de quien radica, así que las consultas se
// hacen con sus propios permisos (radicados:crear). La espera es de 8 segundos por la misma
// razón que en el cliente de catálogos: el primer arranque puede tardar.
export function crearClienteWorkflow(baseUrl) {
  async function llamar(ruta, token, { metodo = 'GET', cuerpo } = {}) {
    let respuesta;
    try {
      respuesta = await fetch(`${baseUrl}/api/workflow${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ErrorApi(503, 'SERVICIO_NO_DISPONIBLE', 'No se pudo consultar servicio-workflow.');
    }
    if (respuesta.status === 403) throw prohibido('No tienes permiso para usar flujos de trabajo.');
    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => null);
      if (respuesta.status === 409 || respuesta.status === 422) {
        throw reglaInvalida(detalle?.mensaje ?? 'servicio-workflow rechazó la solicitud.');
      }
      throw new ErrorApi(502, 'WORKFLOW_ERROR', detalle?.mensaje ?? 'servicio-workflow respondió con un error.');
    }
    return respuesta.json();
  }

  return {
    /** Flujos activos que atienden el tipo documental. */
    flujosDisponibles: (tipoDocumentalId, token) =>
      llamar(`/flujos-disponibles?tipoDocumentalId=${encodeURIComponent(tipoDocumentalId)}`, token),
    iniciarTramite: (datos, token) => llamar('/tramites', token, { metodo: 'POST', cuerpo: datos }),
  };
}
