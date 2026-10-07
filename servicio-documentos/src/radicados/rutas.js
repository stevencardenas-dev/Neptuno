import { Router } from 'express';
import { noEncontrado } from '../errores.js';
import { requierePermiso } from '../seguridad.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function crearRutasRadicados(servicio) {
  const r = Router();
  // Un id mal formado es un 404 (el recurso no existe), no un error de base de datos.
  r.param('id', (_req, _res, next, id) => (UUID.test(id) ? next() : next(noEncontrado('El radicado no existe.'))));

  r.post('/', requierePermiso('radicados:crear'), async (req, res) => {
    const radicado = await servicio.crear(req.actor, req.body);
    res.status(201).location(`/api/documentos/radicados/${radicado.id}`).json(radicado);
  });

  r.get('/', requierePermiso('radicados:consultar'), async (req, res) => {
    res.json(await servicio.listar(req.query));
  });

  r.get('/:id', requierePermiso('radicados:consultar'), async (req, res) => {
    res.json(await servicio.obtener(req.params.id));
  });

  r.put('/:id', requierePermiso('radicados:editar'), async (req, res) => {
    res.json(await servicio.editar(req.actor, req.params.id, req.body));
  });

  return r;
}
