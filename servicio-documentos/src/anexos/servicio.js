import { createHash, randomUUID } from 'node:crypto';
import { ErrorApi, conflicto, noEncontrado, reglaInvalida } from '../errores.js';
import { validarArchivo } from './modelo.js';

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

  return {
    /** HU-025, HU-026: cargar uno o varios archivos al radicado. */
    async cargar(actor, radicadoId, archivo) {
      await radicadoDe(radicadoId);
      const datos = validarArchivo({
        nombre: archivo.nombre,
        tipoMime: archivo.tipoMime,
        tamano: archivo.contenido?.length ?? 0,
      });
      const hashSha256 = createHash('sha256').update(archivo.contenido).digest('hex');
      const objetoClave = `radicados/${radicadoId}/${randomUUID()}.${datos.extension}`;

      try {
        await almacen.guardar(objetoClave, archivo.contenido, datos.tipoMime);
      } catch (error) {
        console.error('No se pudo guardar el anexo en MinIO:', error.message);
        throw ErrorAlmacen();
      }

      try {
        return await repo.insertar({
          radicadoId,
          ...datos,
          tamanoBytes: archivo.contenido.length,
          objetoClave,
          hashSha256,
        }, actor);
      } catch (error) {
        // Si la base rechaza el registro, el objeto no debe quedar huérfano.
        await almacen.eliminar?.(objetoClave).catch(() => {});
        throw error;
      }
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
