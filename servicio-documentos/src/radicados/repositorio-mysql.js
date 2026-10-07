import { randomUUID } from 'node:crypto';
import { conflicto, noEncontrado } from '../errores.js';
import { DIGITO_ORIGEN, formatearCodigo, inicioDiaLocal } from './codigo.js';

const aBuffer = (uuid) => (uuid == null ? null : Buffer.from(uuid.replaceAll('-', ''), 'hex'));
const aUuid = (buf) => {
  if (buf == null) return null;
  const h = buf.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

function aRadicado(f) {
  return {
    id: aUuid(f.id),
    codigo: f.codigo,
    origen: f.origen,
    clase: f.clase,
    tipoDocumentalId: aUuid(f.tipo_documental_id),
    areaId: aUuid(f.area_id),
    asunto: f.asunto,
    remitente: f.remitente,
    destinatario: f.destinatario,
    fechaDocumento: f.fecha_documento,
    folios: f.folios,
    entidadId: aUuid(f.entidad_id),
    carpetaId: aUuid(f.carpeta_id),
    comentarios: f.comentarios,
    estado: f.estado,
    radicadoPor: aUuid(f.radicado_por),
    radicadoEn: f.radicado_en,
    actualizadoPor: aUuid(f.actualizado_por),
    actualizadoEn: f.actualizado_en,
    version: f.version,
  };
}

// Nombre de columna por campo editable (HU-021, HU-039, HU-040).
const COLUMNAS_EDITABLES = {
  clase: ['clase', (v) => v],
  tipoDocumentalId: ['tipo_documental_id', aBuffer],
  areaId: ['area_id', aBuffer],
  asunto: ['asunto', (v) => v],
  remitente: ['remitente', (v) => v],
  destinatario: ['destinatario', (v) => v],
  fechaDocumento: ['fecha_documento', (v) => v],
  folios: ['folios', (v) => v],
  entidadId: ['entidad_id', aBuffer],
  comentarios: ['comentarios', (v) => v],
  actualizadoPor: ['actualizado_por', aBuffer],
  actualizadoEn: ['actualizado_en', (v) => v],
};

const escaparLike = (t) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

async function insertarEvento(cx, fabrica, radicado) {
  const e = fabrica(radicado);
  await cx.execute(
    `insert into evento_saliente (id, tipo, entidad, entidad_id, actor_id, actor_correo, detalle, ocurrido_en)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [aBuffer(randomUUID()), e.tipo, e.entidad, e.entidadId, aBuffer(e.actorId), e.actorCorreo ?? null, e.detalle?.slice(0, 500) ?? null, new Date()],
  );
}

export function crearRepositorioMysql(pool) {
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
    // HU-017: el consecutivo se incrementa de forma atómica dentro de la misma transacción
    // que el radicado; si el insert falla, el número no se consume.
    async insertar(datos, { fecha }, fabricaEvento) {
      return enTransaccion(async (cx) => {
        const digito = DIGITO_ORIGEN[datos.origen];
        await cx.execute(
          `insert into consecutivo_radicado (fecha, origen_digito, ultimo) values (?, ?, last_insert_id(1))
           on duplicate key update ultimo = last_insert_id(ultimo + 1)`,
          [fecha, digito],
        );
        const [[{ n }]] = await cx.query('select last_insert_id() as n');
        const id = randomUUID();
        await cx.execute(
          `insert into radicado (id, codigo, origen, clase, tipo_documental_id, area_id, asunto, remitente, destinatario,
             fecha_documento, folios, entidad_id, comentarios, estado, radicado_por, radicado_en)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            aBuffer(id), formatearCodigo(fecha, digito, Number(n)), datos.origen, datos.clase, aBuffer(datos.tipoDocumentalId),
            aBuffer(datos.areaId), datos.asunto, datos.remitente, datos.destinatario, datos.fechaDocumento, datos.folios,
            aBuffer(datos.entidadId), datos.comentarios ?? null, datos.estado, aBuffer(datos.radicadoPor), datos.radicadoEn,
          ],
        );
        const radicado = await leer(cx, id);
        await insertarEvento(cx, fabricaEvento, radicado);
        return radicado;
      });
    },

    obtener: (id) => leer(pool, id),

    async buscar(f) {
      const donde = [];
      const params = [];
      const agregar = (sql, ...valores) => { donde.push(sql); params.push(...valores); };
      if (f.codigo) agregar('codigo like ?', `%${escaparLike(f.codigo)}%`);
      if (f.q) {
        const patron = `%${escaparLike(f.q)}%`;
        agregar('(asunto like ? or remitente like ? or destinatario like ?)', patron, patron, patron);
      }
      if (f.desde) agregar('radicado_en >= ?', inicioDiaLocal(f.desde));
      if (f.hasta) agregar('radicado_en < ?', new Date(inicioDiaLocal(f.hasta).getTime() + 86_400_000));
      if (f.origen) agregar('origen = ?', f.origen);
      if (f.tipoDocumentalId) agregar('tipo_documental_id = ?', aBuffer(f.tipoDocumentalId));
      if (f.areaId) agregar('area_id = ?', aBuffer(f.areaId));
      if (f.estado) agregar('estado = ?', f.estado);
      const clausula = donde.length ? `where ${donde.join(' and ')}` : '';
      const [[{ total }]] = await pool.query(`select count(*) as total from radicado ${clausula}`, params);
      const [filas] = await pool.query(
        `select * from radicado ${clausula} order by radicado_en desc, codigo desc limit ? offset ?`,
        [...params, f.tamanio, f.pagina * f.tamanio],
      );
      return { contenido: filas.map(aRadicado), total: Number(total), pagina: f.pagina, tamanio: f.tamanio };
    },

    // HU-021: bloqueo optimista. Si la versión ya cambió, nadie pisa la edición de otro.
    async actualizar(id, version, cambios, fabricaEvento) {
      return enTransaccion(async (cx) => {
        const sets = [];
        const params = [];
        for (const [campo, valor] of Object.entries(cambios)) {
          if (valor === undefined) continue;
          const [columna, convertir] = COLUMNAS_EDITABLES[campo];
          sets.push(`${columna} = ?`);
          params.push(convertir(valor));
        }
        const [resultado] = await cx.execute(
          `update radicado set ${sets.join(', ')}, version = version + 1 where id = ? and version = ?`,
          [...params, aBuffer(id), version],
        );
        if (resultado.affectedRows === 0) {
          const existe = await leer(cx, id);
          if (!existe) throw noEncontrado('El radicado no existe.');
          throw conflicto('El radicado fue modificado por otra persona. Recarga los datos e inténtalo de nuevo.');
        }
        const radicado = await leer(cx, id);
        await insertarEvento(cx, fabricaEvento, radicado);
        return radicado;
      });
    },

    async eventosPendientes(limite) {
      const [filas] = await pool.query(
        `select * from evento_saliente where estado_publicacion = 'PENDIENTE' order by ocurrido_en limit ?`,
        [limite],
      );
      return filas.map((f) => ({
        id: aUuid(f.id), tipo: f.tipo, entidad: f.entidad, entidadId: f.entidad_id, actorId: aUuid(f.actor_id),
        actorCorreo: f.actor_correo, detalle: f.detalle, ocurridoEn: f.ocurrido_en,
      }));
    },

    async marcarPublicados(ids) {
      if (!ids.length) return;
      await pool.query(
        `update evento_saliente set estado_publicacion = 'PUBLICADO' where id in (${ids.map(() => '?').join(',')})`,
        ids.map(aBuffer),
      );
    },
  };
}

async function leer(origen, id) {
  const [filas] = await origen.execute('select * from radicado where id = ?', [aBuffer(id)]);
  return filas.length ? aRadicado(filas[0]) : null;
}
