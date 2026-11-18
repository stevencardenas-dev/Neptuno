import { randomUUID } from 'node:crypto';
import { conflicto, noEncontrado } from '../errores.js';

const aBuffer = (uuid) => (uuid == null ? null : Buffer.from(uuid.replaceAll('-', ''), 'hex'));
const aUuid = (buf) => {
  if (buf == null) return null;
  const h = Buffer.from(buf).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

function aPlantilla(f) {
  return {
    id: aUuid(f.id),
    nombre: f.nombre,
    descripcion: f.descripcion,
    version: Number(f.version),
    estado: f.estado,
    creadoPor: aUuid(f.creado_por),
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
  };
}

async function registrarEvento(cx, { tipo, entidad, entidadId, actor, detalle }) {
  await cx.execute(
    `insert into evento_saliente (id, tipo, entidad, entidad_id, actor_id, actor_correo, detalle, ocurrido_en)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [aBuffer(randomUUID()), tipo, entidad, entidadId, aBuffer(actor.id), actor.correo ?? null, detalle?.slice(0, 500) ?? null, new Date()],
  );
}

export function crearRepositorioPlantillas(pool) {
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
    async listar() {
      const [filas] = await pool.query(
        `select p.*, (select count(*) from plantilla_variable v where v.plantilla_id = p.id) as variables,
                (select group_concat(o.origen order by o.origen) from plantilla_origen o where o.plantilla_id = p.id) as origenes
           from plantilla p order by p.nombre asc`,
      );
      return filas.map((fila) => ({
        ...aPlantilla(fila),
        variables: Number(fila.variables),
        origenes: fila.origenes ? fila.origenes.split(',') : [],
      }));
    },

    async obtener(id) {
      const [filas] = await pool.execute('select * from plantilla where id = ?', [aBuffer(id)]);
      if (!filas.length) return null;
      const [variables] = await pool.execute(
        `select bin_to_uuid(id) as id, etiqueta, campo_origen as campoOrigen, obligatoria
           from plantilla_variable where plantilla_id = ? order by etiqueta asc`,
        [aBuffer(id)],
      );
      const [origenes] = await pool.execute(
        'select origen from plantilla_origen where plantilla_id = ? order by origen asc',
        [aBuffer(id)],
      );
      return {
        ...aPlantilla(filas[0]),
        objetoClave: filas[0].objeto_clave,
        variables: variables.map((v) => ({ ...v, obligatoria: Boolean(v.obligatoria) })),
        origenes: origenes.map((o) => o.origen),
      };
    },

    async existeNombre(nombre, exceptoId = null) {
      const [filas] = await pool.execute(
        'select 1 from plantilla where nombre = ? and (? is null or id <> ?) limit 1',
        [nombre, aBuffer(exceptoId), aBuffer(exceptoId)],
      );
      return filas.length > 0;
    },

    async crear(datos, actor) {
      const id = randomUUID();
      try {
        await enTransaccion(async (cx) => {
          await cx.execute(
            `insert into plantilla (id, nombre, descripcion, objeto_clave, version, estado, creado_por, creado_en)
             values (?, ?, ?, ?, 1, 'ACTIVA', ?, ?)`,
            [aBuffer(id), datos.nombre, datos.descripcion ?? null, datos.objetoClave, aBuffer(actor.id), new Date()],
          );
          for (const variable of datos.variables) {
            await cx.execute(
              `insert into plantilla_variable (id, plantilla_id, etiqueta, campo_origen, obligatoria)
               values (?, ?, ?, ?, ?)`,
              [aBuffer(randomUUID()), aBuffer(id), variable.etiqueta, variable.campoOrigen, variable.obligatoria !== false],
            );
          }
          for (const origen of datos.origenes) {
            await cx.execute('insert into plantilla_origen (plantilla_id, origen) values (?, ?)', [aBuffer(id), origen]);
          }
          await registrarEvento(cx, {
            tipo: 'plantilla.creada',
            entidad: 'plantilla',
            entidadId: id,
            actor,
            detalle: `Se creó la plantilla ${datos.nombre} con ${datos.variables.length} variables.`,
          });
        });
      } catch (error) {
        if (error?.errno === 1062) throw conflicto('Ya existe una plantilla con ese nombre.');
        throw error;
      }
      return this.obtener(id);
    },

    async actualizar(id, cambios, actor) {
      try {
        await enTransaccion(async (cx) => {
          await cx.execute(
            `update plantilla set nombre = ?, descripcion = ?, estado = ?, actualizado_en = ?
              where id = ?`,
            [cambios.nombre, cambios.descripcion ?? null, cambios.estado, new Date(), aBuffer(id)],
          );
          await registrarEvento(cx, {
            tipo: 'plantilla.editada',
            entidad: 'plantilla',
            entidadId: id,
            actor,
            detalle: `Se editó la plantilla ${cambios.nombre}.`,
          });
        });
      } catch (error) {
        if (error?.errno === 1062) throw conflicto('Ya existe una plantilla con ese nombre.');
        throw error;
      }
      return this.obtener(id);
    },

    async reemplazarVariables(id, variables, actor) {
      return enTransaccion(async (cx) => {
        await cx.execute('delete from plantilla_variable where plantilla_id = ?', [aBuffer(id)]);
        for (const variable of variables) {
          await cx.execute(
            `insert into plantilla_variable (id, plantilla_id, etiqueta, campo_origen, obligatoria)
             values (?, ?, ?, ?, ?)`,
            [aBuffer(randomUUID()), aBuffer(id), variable.etiqueta, variable.campoOrigen, variable.obligatoria !== false],
          );
        }
        await registrarEvento(cx, {
          tipo: 'plantilla.variables-actualizadas',
          entidad: 'plantilla',
          entidadId: id,
          actor,
          detalle: `Se actualizaron las variables de la plantilla (${variables.length}).`,
        });
        return variables;
      });
    },

    async reemplazarOrigenes(id, origenes, actor) {
      return enTransaccion(async (cx) => {
        await cx.execute('delete from plantilla_origen where plantilla_id = ?', [aBuffer(id)]);
        for (const origen of origenes) {
          await cx.execute('insert into plantilla_origen (plantilla_id, origen) values (?, ?)', [aBuffer(id), origen]);
        }
        await registrarEvento(cx, {
          tipo: 'plantilla.origenes-actualizados',
          entidad: 'plantilla',
          entidadId: id,
          actor,
          detalle: `Se actualizaron los orígenes de la plantilla (${origenes.join(', ')}).`,
        });
        return origenes;
      });
    },

    async radicado(id) {
      const [filas] = await pool.execute(
        `select bin_to_uuid(id) as id, codigo, origen, clase, asunto, remitente, destinatario,
                fecha_documento as fechaDocumento, folios, comentarios, estado,
                bin_to_uuid(tipo_documental_id) as tipoDocumentalId, bin_to_uuid(area_id) as areaId,
                bin_to_uuid(entidad_id) as entidadId, radicado_en as radicadoEn
           from radicado where id = ?`,
        [aBuffer(id)],
      );
      return filas.length ? filas[0] : null;
    },

    async crearGenerado(datos, actor) {
      const id = randomUUID();
      await enTransaccion(async (cx) => {
        await cx.execute(
          `insert into documento_generado
             (id, radicado_id, plantilla_id, plantilla_version, anexo_pdf_id, datos_render, generado_por, generado_en)
           values (?, ?, ?, ?, ?, cast(? as json), ?, ?)`,
          [
            aBuffer(id), aBuffer(datos.radicadoId), aBuffer(datos.plantillaId), datos.version,
            aBuffer(datos.anexoPdfId), JSON.stringify(datos.datos), aBuffer(actor.id), new Date(),
          ],
        );
        await registrarEvento(cx, {
          tipo: 'documento.generado',
          entidad: 'radicado',
          entidadId: datos.radicadoId,
          actor,
          detalle: `Se generó el documento de la plantilla ${datos.plantillaNombre} para el radicado.`,
        });
      });
      return this.generado(id);
    },

    async generado(id) {
      const [filas] = await pool.execute(
        `select bin_to_uuid(g.id) as id, bin_to_uuid(g.radicado_id) as radicadoId,
                bin_to_uuid(g.plantilla_id) as plantillaId, p.nombre as plantillaNombre,
                g.plantilla_version as version, bin_to_uuid(g.anexo_pdf_id) as anexoPdfId,
                g.datos_render as datos, bin_to_uuid(g.generado_por) as generadoPor, g.generado_en as generadoEn
           from documento_generado g join plantilla p on p.id = g.plantilla_id
          where g.id = ?`,
        [aBuffer(id)],
      );
      return filas.length ? filas[0] : null;
    },

    async listarGenerados(radicadoId) {
      const [filas] = await pool.execute(
        `select bin_to_uuid(g.id) as id, bin_to_uuid(g.plantilla_id) as plantillaId, p.nombre as plantillaNombre,
                g.plantilla_version as version, bin_to_uuid(g.anexo_pdf_id) as anexoPdfId,
                g.datos_render as datos, g.generado_en as generadoEn
           from documento_generado g join plantilla p on p.id = g.plantilla_id
          where g.radicado_id = ? order by g.generado_en desc`,
        [aBuffer(radicadoId)],
      );
      return filas;
    },

    /** Los documentos generados no se borran: son constancia de lo que se emitió. */
    async noEncontrado(id) {
      throw noEncontrado(`La plantilla ${id} no existe.`);
    },
  };
}
