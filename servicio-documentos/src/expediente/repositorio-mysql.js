import { randomUUID } from 'node:crypto';
import { conflicto, noEncontrado } from '../errores.js';

const aBuffer = (uuid) => (uuid == null ? null : Buffer.from(uuid.replaceAll('-', ''), 'hex'));
const aUuid = (buf) => {
  if (buf == null) return null;
  const h = Buffer.from(buf).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

function aCarpeta(f) {
  return {
    id: aUuid(f.id),
    areaId: aUuid(f.area_id),
    padreId: aUuid(f.padre_id),
    nombre: f.nombre,
    tipoExpediente: f.tipo_expediente,
    ruta: f.ruta,
    consecutivoDocumentos: Number(f.consecutivo_documentos),
    estado: f.estado,
    creadoPor: aUuid(f.creado_por),
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
  };
}

function aDocumento(f) {
  return {
    id: aUuid(f.id),
    carpetaId: aUuid(f.carpeta_id),
    consecutivo: Number(f.consecutivo),
    titulo: f.titulo,
    descripcion: f.descripcion,
    cargadoPor: aUuid(f.cargado_por),
    cargadoEn: f.cargado_en,
  };
}

async function registrarEvento(cx, { tipo, entidad, entidadId, actor, detalle }) {
  await cx.execute(
    `insert into evento_saliente (id, tipo, entidad, entidad_id, actor_id, actor_correo, detalle, ocurrido_en)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [aBuffer(randomUUID()), tipo, entidad, entidadId, aBuffer(actor.id), actor.correo ?? null, detalle?.slice(0, 500) ?? null, new Date()],
  );
}

export function crearRepositorioExpediente(pool) {
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

  async function leerCarpeta(origen, id) {
    const [filas] = await origen.execute('select * from carpeta where id = ?', [aBuffer(id)]);
    return filas.length ? aCarpeta(filas[0]) : null;
  }

  return {
    /** Todas las carpetas activas; el servicio arma con ellas el árbol visible. */
    async listarCarpetas() {
      const [filas] = await pool.query("select * from carpeta where estado = 'ACTIVO' order by ruta asc");
      return filas.map(aCarpeta);
    },

    async listarAccesos() {
      const [filas] = await pool.query(
        `select bin_to_uuid(id) as id, bin_to_uuid(carpeta_id) as carpetaId,
                tipo_sujeto as tipoSujeto, bin_to_uuid(sujeto_id) as sujetoId, nivel
           from carpeta_acceso`,
      );
      return filas;
    },

    carpeta: (id) => leerCarpeta(pool, id),

    /**
     * Nivel efectivo del actor en la carpeta. El área dueña administra su árbol y un
     * acceso concedido en una carpeta se hereda a sus descendientes (HU-033).
     */
    async nivelAcceso(actor, carpetaId) {
      const [filas] = await pool.execute(
        `with recursive cadena as (
           select id, padre_id, area_id from carpeta where id = ?
           union all
           select c.id, c.padre_id, c.area_id from carpeta c join cadena p on c.id = p.padre_id
         )
         select bin_to_uuid(c.area_id) as areaId, ca.tipo_sujeto as tipo,
                bin_to_uuid(ca.sujeto_id) as sujeto, ca.nivel
           from cadena c left join carpeta_acceso ca on ca.carpeta_id = c.id`,
        [aBuffer(carpetaId)],
      );
      if (!filas.length) return null;
      if (filas.some((fila) => fila.areaId === actor.areaId)) return 'ADMINISTRAR';
      const concedidos = filas
        .filter((fila) => {
          if (!fila.nivel) return false;
          if (fila.tipo === 'AREA') return fila.sujeto === actor.areaId;
          if (fila.tipo === 'ROL') return (actor.rolesIds ?? []).includes(fila.sujeto);
          return false;
        })
        .map((fila) => fila.nivel);
      const orden = { VER: 1, CARGAR: 2, ADMINISTRAR: 3 };
      return concedidos.sort((a, b) => orden[b] - orden[a])[0] ?? null;
    },

    async crearCarpeta(datos, actor) {
      const id = randomUUID();
      try {
        await enTransaccion(async (cx) => {
          await cx.execute(
            `insert into carpeta (id, area_id, padre_id, nombre, tipo_expediente, ruta, estado, creado_por, creado_en)
             values (?, ?, ?, ?, ?, ?, 'ACTIVO', ?, ?)`,
            [
              aBuffer(id), aBuffer(datos.areaId), aBuffer(datos.padreId), datos.nombre,
              datos.tipoExpediente ?? null, datos.ruta, aBuffer(actor.id), new Date(),
            ],
          );
          await registrarEvento(cx, {
            tipo: 'expediente.carpeta-creada',
            entidad: 'carpeta',
            entidadId: id,
            actor,
            detalle: `Se creó la carpeta ${datos.ruta}`,
          });
        });
      } catch (error) {
        if (error?.errno === 1062) {
          throw conflicto('Ya existe una carpeta con ese nombre en el mismo nivel, o esa área ya tiene su carpeta raíz.');
        }
        throw error;
      }
      return leerCarpeta(pool, id);
    },

    /** Renombra la carpeta y reescribe la ruta de todo su subárbol. */
    async editarCarpeta(carpeta, cambios, actor) {
      const rutaNueva = cambios.nombre && cambios.nombre !== carpeta.nombre
        ? `${carpeta.ruta.slice(0, carpeta.ruta.lastIndexOf('/'))}/${cambios.nombre}`
        : carpeta.ruta;
      try {
        await enTransaccion(async (cx) => {
          await cx.execute(
            'update carpeta set nombre = ?, tipo_expediente = ?, ruta = ?, actualizado_en = ? where id = ?',
            [
              cambios.nombre ?? carpeta.nombre,
              cambios.tipoExpediente === undefined ? carpeta.tipoExpediente : cambios.tipoExpediente,
              rutaNueva,
              new Date(),
              aBuffer(carpeta.id),
            ],
          );
          if (rutaNueva !== carpeta.ruta) {
            await cx.execute(
              `update carpeta
                  set ruta = concat(?, substring(ruta, char_length(?) + 1))
                where ruta like ? and id <> ?`,
              [rutaNueva, carpeta.ruta, `${carpeta.ruta}/%`, aBuffer(carpeta.id)],
            );
          }
          await registrarEvento(cx, {
            tipo: 'expediente.carpeta-editada',
            entidad: 'carpeta',
            entidadId: carpeta.id,
            actor,
            detalle: `Se editó la carpeta ${rutaNueva}`,
          });
        });
      } catch (error) {
        if (error?.errno === 1062) throw conflicto('Ya existe una carpeta con ese nombre en el mismo nivel.');
        throw error;
      }
      return leerCarpeta(pool, carpeta.id);
    },

    async contenidoDeCarpeta(carpetaId) {
      const [[hijas], [documentos], [radicados]] = await Promise.all([
        pool.execute("select count(*) as total from carpeta where padre_id = ? and estado = 'ACTIVO'", [aBuffer(carpetaId)]),
        pool.execute('select count(*) as total from documento_expediente where carpeta_id = ?', [aBuffer(carpetaId)]),
        pool.execute('select count(*) as total from radicado where carpeta_id = ?', [aBuffer(carpetaId)]),
      ]);
      return {
        hijas: Number(hijas[0].total),
        documentos: Number(documentos[0].total),
        radicados: Number(radicados[0].total),
      };
    },

    async desactivarCarpeta(carpeta, actor) {
      await enTransaccion(async (cx) => {
        await cx.execute(
          "update carpeta set estado = 'INACTIVO', actualizado_en = ? where id = ?",
          [new Date(), aBuffer(carpeta.id)],
        );
        await registrarEvento(cx, {
          tipo: 'expediente.carpeta-desactivada',
          entidad: 'carpeta',
          entidadId: carpeta.id,
          actor,
          detalle: `Se desactivó la carpeta ${carpeta.ruta}`,
        });
      });
      return leerCarpeta(pool, carpeta.id);
    },

    accesosDe,

    async reemplazarAccesos(carpeta, accesos, actor) {
      return enTransaccion(async (cx) => {
        await cx.execute('delete from carpeta_acceso where carpeta_id = ?', [aBuffer(carpeta.id)]);
        for (const acceso of accesos) {
          await cx.execute(
            `insert into carpeta_acceso (id, carpeta_id, tipo_sujeto, sujeto_id, nivel, creado_por, creado_en)
             values (?, ?, ?, ?, ?, ?, ?)`,
            [aBuffer(randomUUID()), aBuffer(carpeta.id), acceso.tipoSujeto, aBuffer(acceso.sujetoId), acceso.nivel, aBuffer(actor.id), new Date()],
          );
        }
        await registrarEvento(cx, {
          tipo: 'expediente.accesos-actualizados',
          entidad: 'carpeta',
          entidadId: carpeta.id,
          actor,
          detalle: `Se actualizaron los accesos de ${carpeta.ruta} (${accesos.length})`,
        });
        return accesosDe(carpeta.id);
      });
    },

    /** HU-034: documento No radicable con su consecutivo propio de la carpeta. */
    async crearDocumento(carpeta, datos, actor) {
      const id = randomUUID();
      await enTransaccion(async (cx) => {
        const [filas] = await cx.execute(
          'select consecutivo_documentos from carpeta where id = ? for update',
          [aBuffer(carpeta.id)],
        );
        if (!filas.length) throw noEncontrado('La carpeta no existe.');
        const consecutivo = Number(filas[0].consecutivo_documentos) + 1;
        await cx.execute('update carpeta set consecutivo_documentos = ? where id = ?', [consecutivo, aBuffer(carpeta.id)]);
        await cx.execute(
          `insert into documento_expediente (id, carpeta_id, consecutivo, titulo, descripcion, cargado_por, cargado_en)
           values (?, ?, ?, ?, ?, ?, ?)`,
          [aBuffer(id), aBuffer(carpeta.id), consecutivo, datos.titulo, datos.descripcion ?? null, aBuffer(actor.id), new Date()],
        );
        await registrarEvento(cx, {
          tipo: 'expediente.documento-cargado',
          entidad: 'documento-expediente',
          entidadId: id,
          actor,
          detalle: `Se cargó el documento No radicable ${datos.titulo} en ${carpeta.ruta}`,
        });
      });
      return this.documento(id);
    },

    async documento(id) {
      const [filas] = await pool.execute(
        `select d.*, bin_to_uuid(c.id) as carpeta, c.ruta
           from documento_expediente d join carpeta c on c.id = d.carpeta_id
          where d.id = ?`,
        [aBuffer(id)],
      );
      return filas.length ? { ...aDocumento(filas[0]), carpetaRuta: filas[0].ruta, carpetaId: filas[0].carpeta } : null;
    },

    async documentoExiste(id) {
      const [filas] = await pool.execute(
        "select 1 from documento_expediente d join carpeta c on c.id = d.carpeta_id where d.id = ? and c.estado = 'ACTIVO'",
        [aBuffer(id)],
      );
      return filas.length > 0;
    },

    async listarDocumentos() {
      const [filas] = await pool.query(
        `select d.*, bin_to_uuid(c.id) as carpeta, c.ruta
           from documento_expediente d join carpeta c on c.id = d.carpeta_id
          where c.estado = 'ACTIVO'
          order by d.cargado_en asc`,
      );
      return filas.map((fila) => ({
        ...aDocumento(fila),
        carpetaId: fila.carpeta,
        carpetaRuta: fila.ruta,
      }));
    },

    async listarDocumentosDeCarpeta(carpetaId) {
      const [filas] = await pool.execute(
        'select * from documento_expediente where carpeta_id = ? order by consecutivo asc',
        [aBuffer(carpetaId)],
      );
      return filas.map(aDocumento);
    },

    /** Radicados archivados en alguna carpeta, para dibujarlos en el árbol (HU-032). */
    async radicadosEnCarpetas() {
      const [filas] = await pool.query(
        `select bin_to_uuid(id) as id, codigo, asunto, estado, bin_to_uuid(carpeta_id) as carpetaId,
                radicado_en as radicadoEn
           from radicado where carpeta_id is not null
          order by radicado_en asc`,
      );
      return filas;
    },
  };

  async function accesosDe(carpetaId) {
    const [filas] = await pool.execute(
      `select bin_to_uuid(id) as id, tipo_sujeto as tipoSujeto, bin_to_uuid(sujeto_id) as sujetoId, nivel,
              bin_to_uuid(creado_por) as creadoPor, creado_en as creadoEn
         from carpeta_acceso where carpeta_id = ? order by creado_en asc`,
      [aBuffer(carpetaId)],
    );
    return filas;
  }
}
