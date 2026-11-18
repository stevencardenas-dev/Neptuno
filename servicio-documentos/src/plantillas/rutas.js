import express, { Router } from 'express';
import { noEncontrado, reglaInvalida } from '../errores.js';
import { requierePermiso } from '../seguridad.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodificar(valor) {
  if (!valor) return null;
  try {
    return decodeURIComponent(valor);
  } catch {
    throw reglaInvalida('La cabecera de la plantilla no está codificada correctamente.');
  }
}

/**
 * Plantillas DOCX (HU-035…HU-038). El archivo viaja como cuerpo binario, igual que los
 * anexos, y sus metadatos en cabeceras `X-*` para no mezclar multipart.
 */
export function crearRutasPlantillas(servicio) {
  const r = Router();
  r.param('id', (_req, _res, next, id) => (UUID.test(id) ? next() : next(noEncontrado('La plantilla no existe.'))));

  r.get('/plantillas', requierePermiso('plantillas:administrar', 'plantillas:usar'), async (_req, res) => {
    res.json(await servicio.listar());
  });

  r.get('/plantillas/:id', requierePermiso('plantillas:administrar', 'plantillas:usar'), async (req, res) => {
    res.json(await servicio.obtener(req.params.id));
  });

  r.post(
    '/plantillas',
    requierePermiso('plantillas:administrar'),
    express.raw({ type: () => true, limit: '10mb' }),
    async (req, res) => {
      const nombreArchivo = decodificar(req.get('x-nombre-archivo'));
      if (!nombreArchivo) throw reglaInvalida('Falta la cabecera X-Nombre-Archivo con el nombre del DOCX.');
      const metadatos = {
        nombre: decodificar(req.get('x-nombre-plantilla')),
        descripcion: decodificar(req.get('x-descripcion-plantilla')),
        origenes: (req.get('x-origenes') ?? '')
          .split(',')
          .map((origen) => origen.trim().toUpperCase())
          .filter(Boolean),
      };
      const plantilla = await servicio.crear(
        req.actor,
        { nombre: nombreArchivo, tipoMime: req.get('content-type'), contenido: req.body },
        metadatos,
      );
      res.status(201).location(`/api/documentos/plantillas/${plantilla.id}`).json(plantilla);
    },
  );

  r.put('/plantillas/:id', requierePermiso('plantillas:administrar'), async (req, res) => {
    res.json(await servicio.editar(req.actor, req.params.id, req.body));
  });

  r.put('/plantillas/:id/variables', requierePermiso('plantillas:administrar'), async (req, res) => {
    res.json(await servicio.reemplazarVariables(req.actor, req.params.id, req.body));
  });

  r.put('/plantillas/:id/origenes', requierePermiso('plantillas:administrar'), async (req, res) => {
    res.json(await servicio.reemplazarOrigenes(req.actor, req.params.id, req.body));
  });

  /** HU-037, HU-038: generar el documento a partir de la plantilla. */
  r.post('/radicados/:id/documentos-generados', requierePermiso('plantillas:usar', 'plantillas:administrar'), async (req, res) => {
    if (!UUID.test(req.params.id)) throw noEncontrado('El radicado no existe.');
    const generado = await servicio.generar(req.actor, req.params.id, req.body);
    res.status(201).json(generado);
  });

  r.get('/radicados/:id/documentos-generados', requierePermiso('plantillas:usar', 'plantillas:administrar', 'radicados:consultar'), async (req, res) => {
    if (!UUID.test(req.params.id)) throw noEncontrado('El radicado no existe.');
    res.json(await servicio.listarGenerados(req.params.id));
  });

  return r;
}
