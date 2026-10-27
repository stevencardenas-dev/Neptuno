import { Router } from 'express';
import { noEncontrado, reglaInvalida } from '../errores.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS = ['EN_TRAMITE', 'FINALIZADO', 'RADICADO', 'ANULADO'];

/**
 * API interna para servicio-workflow (HU-062, HU-078): el flujo necesita el resumen
 * del radicado para la bandeja y avisar cuando el trámite empieza o termina.
 *
 * Se autentica con `X-Servicio-Clave`, no con el token del usuario: quien actúa es el
 * flujo, no la persona que en ese momento tiene la tarea.
 */
export function crearRutasInternas(servicio) {
  const r = Router();

  r.get('/radicados/:id', async (req, res) => {
    if (!UUID.test(req.params.id)) throw noEncontrado('El radicado no existe.');
    const radicado = await servicio.obtener(req.params.id);
    res.json({
      id: radicado.id,
      codigo: radicado.codigo,
      asunto: radicado.asunto,
      estado: radicado.estado,
      tipoDocumentalId: radicado.tipoDocumentalId,
      origen: radicado.origen,
      areaId: radicado.areaId,
      radicadoPor: radicado.radicadoPor,
    });
  });

  r.patch('/radicados/:id/estado', async (req, res) => {
    if (!UUID.test(req.params.id)) throw noEncontrado('El radicado no existe.');
    const estado = req.body?.estado;
    if (!ESTADOS.includes(estado)) {
      throw reglaInvalida(`El estado debe ser uno de: ${ESTADOS.join(', ')}.`);
    }
    res.json(await servicio.cambiarEstadoSistema(req.params.id, estado));
  });

  return r;
}
