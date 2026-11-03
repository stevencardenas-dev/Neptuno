import { randomUUID } from 'node:crypto';
import { conflicto } from '../errores.js';

const aBuffer = (uuid) => (uuid == null ? null : Buffer.from(uuid.replaceAll('-', ''), 'hex'));
const aUuid = (buf) => {
  if (buf == null) return null;
  const h = Buffer.from(buf).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const uuidDe = (valor) => (typeof valor === 'string' ? valor : aUuid(valor));

const COLUMNAS = `bin_to_uuid(c.id) as id, bin_to_uuid(c.radicado_id) as radicadoId,
  bin_to_uuid(c.destinatario_id) as destinatarioId, c.mensaje, bin_to_uuid(c.enviada_por) as enviadaPor,
  c.enviada_en as enviadaEn, c.leida_en as leidaEn,
  r.codigo as radicadoCodigo, r.asunto as radicadoAsunto, r.origen as radicadoOrigen, r.estado as radicadoEstado`;

function aCopia(f) {
  return {
    id: uuidDe(f.id),
    radicadoId: uuidDe(f.radicadoId),
    destinatarioId: uuidDe(f.destinatarioId),
    mensaje: f.mensaje,
    enviadaPor: uuidDe(f.enviadaPor),
    enviadaEn: f.enviadaEn,
    leidaEn: f.leidaEn,
    radicado: {
      id: uuidDe(f.radicadoId),
      codigo: f.radicadoCodigo,
      asunto: f.radicadoAsunto,
      origen: f.radicadoOrigen,
      estado: f.radicadoEstado,
    },
  };
}

export function crearRepositorioCopias(pool) {
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

  async function leer(id) {
    const [filas] = await pool.execute(
      `select ${COLUMNAS} from copia_informativa c join radicado r on r.id = c.radicado_id where c.id = ?`,
      [aBuffer(id)],
    );
    return filas.length ? aCopia(filas[0]) : null;
  }

  return {
    async radicado(id) {
      const [filas] = await pool.execute(
        'select bin_to_uuid(id) as id, codigo, asunto, origen, estado from radicado where id = ?',
        [aBuffer(id)],
      );
      return filas.length ? filas[0] : null;
    },

    /** HU-041: enviar la copia y dejar su evento. */
    async crear({ radicadoId, destinatarioId, mensaje }, actor) {
      const id = randomUUID();
      try {
        await enTransaccion(async (cx) => {
          await cx.execute(
            `insert into copia_informativa (id, radicado_id, destinatario_id, mensaje, enviada_por, enviada_en)
             values (?, ?, ?, ?, ?, ?)`,
            [aBuffer(id), aBuffer(radicadoId), aBuffer(destinatarioId), mensaje ?? null, aBuffer(actor.id), new Date()],
          );
          await cx.execute(
            `insert into evento_saliente (id, tipo, entidad, entidad_id, actor_id, actor_correo, detalle, ocurrido_en)
             values (?, 'copia.enviada', 'radicado', ?, ?, ?, ?, ?)`,
            [aBuffer(randomUUID()), radicadoId, aBuffer(actor.id), actor.correo ?? null, 'Se envió una copia informativa del radicado.', new Date()],
          );
        });
      } catch (error) {
        if (error?.errno === 1062) throw conflicto('Ese usuario ya tiene una copia de este radicado.');
        throw error;
      }
      return leer(id);
    },

    async enviadas(radicadoId) {
      const [filas] = await pool.execute(
        `select ${COLUMNAS}
           from copia_informativa c join radicado r on r.id = c.radicado_id
          where c.radicado_id = ? order by c.enviada_en asc`,
        [aBuffer(radicadoId)],
      );
      return filas.map(aCopia);
    },

  };
}
