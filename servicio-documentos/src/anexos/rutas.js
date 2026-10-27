import express, { Router } from 'express';
import { reglaInvalida, noEncontrado } from '../errores.js';
import { requierePermiso } from '../seguridad.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idValido(...ids) {
  return ids.every((id) => UUID.test(id));
}

/** Convierte el flujo de MinIO en la respuesta HTTP de descarga. */
function enviarArchivo(flujo, anexo, res) {
  res.setHeader('Content-Type', anexo.tipoMime);
  res.setHeader('Content-Length', String(anexo.tamanoBytes));
  // El nombre viaja entre comillas y con los caracteres problemáticos escapados.
  const nombre = anexo.nombreOriginal.replace(/["\\]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(anexo.nombreOriginal)}`);
  flujo.on('error', () => res.destroy());
  flujo.pipe(res);
}

/**
 * HU-025…HU-029: cargar, listar, descargar y eliminar anexos.
 *
 * El cargue no usa multipart: el archivo viaja como cuerpo binario y su nombre en la
 * cabecera `X-Nombre-Archivo`. Así se evita una dependencia de parseo y el límite de
 * tamaño lo aplica `express.raw`.
 */
export function crearRutasAnexos(servicio) {
  const r = Router();

  r.post(
    '/radicados/:id/anexos',
    requierePermiso('anexos:cargar'),
    express.raw({ type: () => true, limit: '10mb' }),
    async (req, res) => {
      if (!idValido(req.params.id)) throw noEncontrado('El radicado no existe.');
      const nombre = req.get('x-nombre-archivo');
      if (!nombre) throw reglaInvalida('Falta la cabecera X-Nombre-Archivo con el nombre del archivo.');
      let decodificado;
      try {
        decodificado = decodeURIComponent(nombre);
      } catch {
        throw reglaInvalida('El nombre del archivo no está codificado correctamente.');
      }
      const anexo = await servicio.cargar(req.actor, req.params.id, {
        nombre: decodificado,
        tipoMime: req.get('content-type'),
        contenido: req.body,
      });
      res.status(201).location(`/api/documentos/anexos/${anexo.id}`).json(anexo);
    },
  );

  r.get('/radicados/:id/anexos', requierePermiso('radicados:consultar'), async (req, res) => {
    if (!idValido(req.params.id)) throw noEncontrado('El radicado no existe.');
    res.json(await servicio.listar(req.params.id));
  });

  r.get('/anexos/:anexoId/descarga', requierePermiso('radicados:consultar'), async (req, res) => {
    if (!idValido(req.params.anexoId)) throw noEncontrado('El anexo no existe.');
    const { anexo, flujo } = await servicio.descargar(req.params.anexoId);
    enviarArchivo(flujo, anexo, res);
  });

  r.delete('/anexos/:anexoId', requierePermiso('anexos:eliminar'), async (req, res) => {
    if (!idValido(req.params.anexoId)) throw noEncontrado('El anexo no existe.');
    res.json(await servicio.eliminar(req.actor, req.params.anexoId, req.body?.motivo));
  });

  return r;
}
