import { Router } from 'express';
import { noEncontrado } from '../errores.js';
import { requierePermiso } from '../seguridad.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idValido = (id) => UUID.test(id);

/** HU-041: enviar copias de un radicado y consultar a quién se enviaron. */
export function crearRutasCopias(servicio) {
  const r = Router();

  r.post('/radicados/:id/copias', requierePermiso('radicados:consultar'), async (req, res) => {
    if (!idValido(req.params.id)) throw noEncontrado('El radicado no existe.');
    const copia = await servicio.enviar(req.actor, req.params.id, req.body);
    res.status(201).location(`/api/documentos/copias/${copia.id}`).json(copia);
  });

  r.get('/radicados/:id/copias', requierePermiso('radicados:consultar'), async (req, res) => {
    if (!idValido(req.params.id)) throw noEncontrado('El radicado no existe.');
    res.json(await servicio.enviadas(req.params.id));
  });

  return r;
}
