import express from 'express';
import { ErrorApi, noEncontrado } from './errores.js';
import { autenticar } from './seguridad.js';
import { crearServicioRadicados } from './radicados/servicio.js';
import { crearRutasRadicados } from './radicados/rutas.js';
import { crearRutasInternas } from './interno/rutas.js';
import { exigirClaveServicios } from './seguridad.js';

export function crearApp({ config, repo, catalogos, comprobarSalud = async () => {}, ahora }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/healthz', async (_req, res) => {
    try {
      await comprobarSalud();
      res.json({ estado: 'UP' });
    } catch {
      res.status(503).json({ estado: 'DOWN' });
    }
  });

  const servicio = crearServicioRadicados({ repo, catalogos, ahora });

  // Las rutas internas se montan antes que la API con JWT: no usan token de usuario.
  if (config.claveServicios) {
    app.use('/api/documentos/interno', exigirClaveServicios(config.claveServicios), crearRutasInternas(servicio));
  }

  const api = express.Router();
  api.use(autenticar(config.jwt));
  api.use('/radicados', crearRutasRadicados(servicio));
  app.use('/api/documentos', api);

  app.use((_req, _res, next) => next(noEncontrado('La ruta no existe.')));

  // Express 5 propaga a este manejador también los rechazos de los handlers async.
  app.use((error, _req, res, _next) => {
    let estado = 500, codigo = 'ERROR_INTERNO', mensaje = 'Ocurrió un error inesperado.', detalles = [];
    if (error instanceof ErrorApi) {
      ({ estado, codigo, detalles } = error);
      mensaje = error.message;
    }
    if (error.type === 'entity.parse.failed') {
      estado = 400; codigo = 'JSON_INVALIDO'; mensaje = 'El cuerpo de la solicitud no es un JSON válido.';
    } else if (!(error instanceof ErrorApi) && error.status === 413) {
      estado = 413; codigo = 'CUERPO_DEMASIADO_GRANDE'; mensaje = 'El cuerpo de la solicitud es demasiado grande.';
    } else if (estado === 500) {
      console.error(error);
    }
    res.status(estado).json({ codigo, mensaje, detalles, momento: new Date().toISOString() });
  });

  return app;
}
