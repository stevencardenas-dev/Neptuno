import { createHash, randomUUID } from 'node:crypto';
import { ErrorApi, conflicto, noEncontrado, reglaInvalida } from '../errores.js';
import { validarArchivo } from './modelo.js';

/** HU-027: máximo de archivos que se pueden enviar en una sola carga. */
export const MAX_ARCHIVOS_POR_LOTE = 8;

/**
 * Anexos de un radicado (HU-025…HU-029). El archivo se guarda en MinIO y la base
 * conserva los metadatos: nombre original, extensión, MIME, tamaño y SHA-256.
 */
export function crearServicioAnexos({ repo, almacen }) {
  async function radicadoDe(radicadoId) {
    const estado = await repo.radicadoExiste(radicadoId);
    if (!estado) throw noEncontrado('El radicado no existe.');
    if (estado === 'ANULADO') throw conflicto('Un radicado anulado no admite anexos.');
    return estado;
  }

  /** Valida el archivo y prepara su registro antes de tocar el almacén. */
  function preparar(destino, archivo) {
    const datos = validarArchivo({
      nombre: archivo.nombre,
      tipoMime: archivo.tipoMime,
      tamano: archivo.contenido?.length ?? 0,
    });
    const anexo = {
      ...destino,
      ...datos,
      procedencia: 'CARGA',
      tamanoBytes: archivo.contenido.length,
      hashSha256: createHash('sha256').update(archivo.contenido).digest('hex'),
      objetoClave: `radicados/${destino.radicadoId}/${randomUUID()}.${datos.extension}`,
    };
    return { anexo, contenido: archivo.contenido };
  }

  /** Sube todos los objetos y luego inserta los registros; si algo falla, limpia el almacén. */
  async function guardar(actor, preparados) {
    const subidos = [];
    try {
      for (const { anexo, contenido } of preparados) {
        await almacen.guardar(anexo.objetoClave, contenido, anexo.tipoMime);
        subidos.push(anexo.objetoClave);
      }
    } catch (error) {
      await Promise.all(subidos.map((clave) => almacen.eliminar?.(clave).catch(() => {})));
      console.error('No se pudieron guardar los anexos en MinIO:', error.message);
      throw ErrorAlmacen();
    }
    try {
      return await repo.insertarLote(preparados.map(({ anexo }) => anexo), actor);
    } catch (error) {
      // Ni objetos huérfanos ni registros a medias: si la base rechaza, se borra lo subido.
      await Promise.all(subidos.map((clave) => almacen.eliminar?.(clave).catch(() => {})));
      throw error;
    }
  }

  return {
    /** HU-025, HU-026: cargar un archivo al radicado. */
    async cargar(actor, radicadoId, archivo) {
      await radicadoDe(radicadoId);
      const [anexo] = await guardar(actor, [preparar({ radicadoId }, archivo)]);
      return anexo;
    },

    /** HU-027: varios archivos del radicado en una sola petición. */
    async cargarLote(actor, radicadoId, archivos) {
      await radicadoDe(radicadoId);
      if (!Array.isArray(archivos) || archivos.length === 0) {
        throw reglaInvalida('Envía al menos un archivo.');
      }
      if (archivos.length > MAX_ARCHIVOS_POR_LOTE) {
        throw reglaInvalida(`Se pueden cargar como máximo ${MAX_ARCHIVOS_POR_LOTE} archivos a la vez.`);
      }
      // Se validan todos antes de subir el primero: un lote inválido no deja nada a medias.
      const preparados = archivos.map((archivo) => preparar({ radicadoId }, archivo));
      return guardar(actor, preparados);
    },

    /** HU-027 */
    async listar(radicadoId) {
      await radicadoDe(radicadoId);
      return repo.listar(radicadoId);
    },

    /** HU-027, HU-028: metadatos y flujo de lectura del objeto. */
    async descargar(anexoId) {
      const anexo = await repo.obtener(anexoId);
      if (!anexo) throw noEncontrado('El anexo no existe.');
      if (anexo.eliminadoEn) throw noEncontrado('El anexo fue eliminado.');
      try {
        return { anexo, flujo: await almacen.abrir(anexo.objetoClave) };
      } catch (error) {
        console.error('No se pudo leer el anexo de MinIO:', error.message);
        throw ErrorAlmacen();
      }
    },

    /** HU-029: eliminar con un motivo obligatorio. */
    async eliminar(actor, anexoId, motivo) {
      const texto = String(motivo ?? '').trim();
      if (texto.length < 3) throw reglaInvalida('Explica el motivo de la eliminación (mínimo 3 caracteres).');
      if (texto.length > 500) throw reglaInvalida('El motivo no puede superar 500 caracteres.');
      return repo.eliminar(anexoId, texto, actor);
    },
  };
}

/**
 * La clave del objeto se guarda en la base y solo la usa el servicio para hablar con
 * MinIO; no forma parte de la respuesta del API.
 */
function ErrorAlmacen() {
  return new ErrorApi(503, 'ALMACEN_NO_DISPONIBLE', 'El almacén de archivos no está disponible. Inténtalo de nuevo.');
}
