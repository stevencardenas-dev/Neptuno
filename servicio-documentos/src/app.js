import express from 'express';
import { ErrorApi, noEncontrado } from './errores.js';
import { autenticar, exigirClaveServicios } from './seguridad.js';
import { crearServicioRadicados } from './radicados/servicio.js';
import { crearRutasRadicados } from './radicados/rutas.js';
import { crearServicioAnexos } from './anexos/servicio.js';
import { crearRutasAnexos } from './anexos/rutas.js';
import { crearRutasInternas } from './interno/rutas.js';
import { crearServicioExpediente } from './expediente/servicio.js';
import { crearRutasExpediente } from './expediente/rutas.js';
import { crearServicioPlantillas } from './plantillas/servicio.js';
import { crearRutasPlantillas } from './plantillas/rutas.js';
import { crearServicioCopias } from './copias/servicio.js';
import { crearRutasCopias } from './copias/rutas.js';

export function crearApp({ config, repo, repoAnexos, repoExpediente, repoPlantillas, repoCopias, almacen, catalogos, workflow, comprobarSalud = async () => {}, ahora }) {
  const app = express();
  app.disable('x-powered-by');
  // La carga múltiple de anexos (HU-027) trae varios archivos en base64 y necesita un
  // límite propio; el resto del API se queda con el límite pequeño.
  const jsonPequenio = express.json({ limit: '100kb' });
  app.use((req, res, next) => (req.path.endsWith('/anexos/lote') ? next() : jsonPequenio(req, res, next)));

  app.get('/healthz', async (_req, res) => {
    try {
      await comprobarSalud();
      res.json({ estado: 'UP' });
    } catch {
      res.status(503).json({ estado: 'DOWN' });
    }
  });

  const expediente = repoExpediente ? crearServicioExpediente({ repo: repoExpediente, catalogos }) : null;
  const servicio = crearServicioRadicados({ repo, catalogos, workflow, expediente, ahora });

  // Las rutas internas se montan antes que la API con JWT: no usan token de usuario.
  if (config.claveServicios) {
    app.use('/api/documentos/interno', exigirClaveServicios(config.claveServicios), crearRutasInternas(servicio, repoAnexos));
  }

  const api = express.Router();
  api.use(autenticar(config.jwt));
  api.use('/radicados', crearRutasRadicados(servicio));
  if (expediente) api.use('/expediente', crearRutasExpediente(expediente));
  const servicioAnexos = repoAnexos && almacen ? crearServicioAnexos({ repo: repoAnexos, almacen }) : null;
  if (servicioAnexos) api.use(crearRutasAnexos(servicioAnexos, expediente));
  if (repoPlantillas && servicioAnexos) {
    api.use(crearRutasPlantillas(crearServicioPlantillas({ repo: repoPlantillas, anexos: servicioAnexos, almacen })));
  }
  if (repoCopias) {
    api.use(crearRutasCopias(crearServicioCopias({ repo: repoCopias, catalogos })));
  }
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
