import { randomUUID } from 'node:crypto';
import { conflicto, noEncontrado } from '../errores.js';

const aBuffer = (uuid) => Buffer.from(uuid.replaceAll('-', ''), 'hex');
const aUuid = (buf) => {
  if (buf == null) return null;
  const h = Buffer.from(buf).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

function aAnexo(f) {
  return {
    id: aUuid(f.id),
    radicadoId: aUuid(f.radicado_id),
    nombreOriginal: f.nombre_original,
    extension: f.extension,
    tipoMime: f.tipo_mime,
    tamanoBytes: Number(f.tamano_bytes),
    hashSha256: f.hash_sha256,
    procedencia: f.procedencia,
    cargadoPor: aUuid(f.cargado_por),
    cargadoEn: f.cargado_en,
    eliminadoEn: f.eliminado_en,
    eliminadoPor: aUuid(f.eliminado_por),
    motivoEliminacion: f.motivo_eliminacion,
  };
}

async function registrarEvento(cx, { tipo, anexoId, actor, detalle }) {
  await cx.execute(
    `insert into evento_saliente (id, tipo, entidad, entidad_id, actor_id, actor_correo, detalle, ocurrido_en)
     values (?, ?, 'anexo', ?, ?, ?, ?, ?)`,
    [aBuffer(randomUUID()), tipo, anexoId, aBuffer(actor.id), actor.correo ?? null, detalle?.slice(0, 500) ?? null, new Date()],
  );
}

export function crearRepositorioAnexos(pool) {
  async function enTransaccion(trabajo) {
    const cx = await pool.getConnection();
    try {
      await cx.beginTransaction();
      const resultado = await trabajo(cx);
      await cx.commit();
      return resultado;
    } catch (error) {
      await cx.rollback();
      throw error;
    } finally {
      cx.release();
    }
  }

  return {
    /** HU-025: el anexo y su evento entran juntos. */
    async insertar(datos, actor) {
      const id = randomUUID();
      return enTransaccion(async (cx) => {
        await cx.execute(
          `insert into anexo (id, radicado_id, nombre_original, extension, tipo_mime, tamano_bytes,
             objeto_clave, hash_sha256, procedencia, cargado_por, cargado_en)
           values (?, ?, ?, ?, ?, ?, ?, ?, 'CARGA', ?, ?)`,
          [
            aBuffer(id), aBuffer(datos.radicadoId), datos.nombreOriginal, datos.extension, datos.tipoMime,
            datos.tamanoBytes, datos.objetoClave, datos.hashSha256, aBuffer(actor.id), new Date(),
          ],
        );
        await registrarEvento(cx, {
          tipo: 'anexo.cargado',
          anexoId: id,
          actor,
          detalle: `Se cargó el anexo ${datos.nombreOriginal} (${datos.tamanoBytes} bytes).`,
        });
        return aAnexo(await leer(cx, id));
      });
    },

    /** HU-027: anexos vigentes de un radicado. */
    async listar(radicadoId) {
      const [filas] = await pool.execute(
        `select * from anexo
          where radicado_id = ? and eliminado_en is null
          order by cargado_en asc`,
        [aBuffer(radicadoId)],
      );
      return filas.map(aAnexo);
    },

    async obtener(id) {
      const fila = await leer(pool, id);
      if (!fila) return null;
      return { ...aAnexo(fila), objetoClave: fila.objeto_clave };
    },

    async radicadoExiste(radicadoId) {
      const [filas] = await pool.execute('select estado from radicado where id = ?', [aBuffer(radicadoId)]);
      return filas.length ? filas[0].estado : null;
    },

    /** HU-029: baja lógica con motivo; el objeto se conserva para no romper la constancia. */
    async eliminar(id, motivo, actor) {
      return enTransaccion(async (cx) => {
        const [resultado] = await cx.execute(
          `update anexo
              set eliminado_en = ?, eliminado_por = ?, motivo_eliminacion = ?
            where id = ? and eliminado_en is null`,
          [new Date(), aBuffer(actor.id), motivo, aBuffer(id)],
        );
        if (resultado.affectedRows === 0) {
          const actual = await leer(cx, id);
          if (!actual) throw noEncontrado('El anexo no existe.');
          throw conflicto('El anexo ya había sido eliminado.');
        }
        await registrarEvento(cx, {
          tipo: 'anexo.eliminado',
          anexoId: id,
          actor,
          detalle: `Se eliminó un anexo: ${motivo}`,
        });
        return aAnexo(await leer(cx, id));
      });
    },
  };
}

async function leer(origen, id) {
  const [filas] = await origen.execute('select * from anexo where id = ?', [aBuffer(id)]);
  return filas.length ? filas[0] : null;
}
