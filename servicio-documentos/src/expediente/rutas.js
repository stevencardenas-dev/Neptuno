import { Router } from 'express';
import { noEncontrado } from '../errores.js';
import { requierePermiso } from '../seguridad.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rutas del expediente central (HU-030…HU-034). El árbol solo muestra lo que el rol
 * puede ver; las operaciones de administración se comprueban además en el servicio.
 */
export function crearRutasExpediente(servicio) {
  const r = Router();
  r.param('id', (_req, _res, next, id) => (UUID.test(id) ? next() : next(noEncontrado('La carpeta no existe.'))));
  r.param('documentoId', (_req, _res, next, id) => (UUID.test(id) ? next() : next(noEncontrado('El documento no existe.'))));

  r.get('/arbol', requierePermiso('expediente:ver', 'expediente:administrar'), async (req, res) => {
    res.json(await servicio.arbol(req.actor));
  });

  r.post('/carpetas', requierePermiso('expediente:administrar'), async (req, res) => {
    const carpeta = await servicio.crearCarpeta(req.actor, req.body);
    res.status(201).location(`/api/documentos/expediente/carpetas/${carpeta.id}`).json(carpeta);
  });

  r.put('/carpetas/:id', requierePermiso('expediente:administrar'), async (req, res) => {
    res.json(await servicio.editarCarpeta(req.actor, req.params.id, req.body));
  });

  r.delete('/carpetas/:id', requierePermiso('expediente:administrar'), async (req, res) => {
    res.json(await servicio.desactivarCarpeta(req.actor, req.params.id));
  });

  r.get('/carpetas/:id/accesos', requierePermiso('expediente:ver', 'expediente:administrar'), async (req, res) => {
    res.json(await servicio.listarAccesos(req.actor, req.params.id));
  });

  r.put('/carpetas/:id/accesos', requierePermiso('expediente:administrar'), async (req, res) => {
    res.json(await servicio.reemplazarAccesos(req.actor, req.params.id, req.body));
  });

  r.get('/carpetas/:id/documentos', requierePermiso('expediente:ver', 'expediente:administrar'), async (req, res) => {
    res.json(await servicio.listarDocumentos(req.actor, req.params.id));
  });

  /** HU-034: documento No radicable. Sus archivos se cargan por las rutas de anexos. */
  r.post('/carpetas/:id/documentos', requierePermiso('expediente:cargar', 'expediente:administrar'), async (req, res) => {
    const documento = await servicio.crearDocumento(req.actor, req.params.id, req.body);
    res.status(201).location(`/api/documentos/expediente/documentos/${documento.id}`).json(documento);
  });

  r.get('/documentos/:documentoId', requierePermiso('expediente:ver', 'expediente:administrar'), async (req, res) => {
    res.json(await servicio.obtenerDocumento(req.actor, req.params.documentoId));
  });

  return r;
}
