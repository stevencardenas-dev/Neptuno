import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import type { Autor } from '../bandeja';
import { enTransaccion, registrarEvento } from '../bandeja';
import { POOL } from '../db';
import { conflicto, noEncontrado } from '../errores';
import type {
  Accion,
  Grafo,
  Paso,
  PasoCrear,
  PasoEditar,
  Responsable,
  TipoEstado,
  TipoSujeto,
  Transicion,
  TransicionCrear,
  TransicionEditar,
  VersionDeTrabajo,
} from './modelo';

/**
 * Acceso a la definición de un flujo: pasos, transiciones y responsables (HU-050 y
 * HU-052…HU-061). Dos reglas se cuidan aquí porque necesitan la transacción completa:
 *
 *  - la definición vive en la versión **en borrador** del flujo; si no existe se crea en
 *    el momento del primer cambio, y si el flujo ya está publicado se rechaza la edición
 *    (los trámites en curso no pueden cambiar de recorrido);
 *  - el hecho y el cambio se guardan juntos en la bandeja de salida.
 *
 * Los errores de "no existe" y "no se puede" se levantan desde aquí porque solo dentro de
 * la transacción se sabe si la versión sigue siendo editable.
 */

/** Separación entre pasos cuando el servidor escoge el sitio en el lienzo. */
const PASO_ANCHO = 220;
const PASO_ALTO = 140;

interface FilaFlujo extends RowDataPacket {
  id: string;
  nombre: string;
  estado: string;
  versionActivaId: string | null;
}

interface FilaVersion extends RowDataPacket {
  id: string;
  numero: number;
  estado: string;
}

interface FilaPaso extends RowDataPacket {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoEstado;
  posicionX: number;
  posicionY: number;
}

interface FilaTransicion extends RowDataPacket {
  id: string;
  estadoOrigenId: string;
  estadoDestinoId: string;
  accion: Accion;
  etiqueta: string | null;
}

interface FilaResponsable extends RowDataPacket {
  id: string;
  estadoId: string;
  tipoSujeto: TipoSujeto;
  sujetoId: string;
}

@Injectable()
export class RepositorioDisenador {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  // --- Lectura -------------------------------------------------------------------

  async flujo(id: string): Promise<FilaFlujo | null> {
    const [filas] = await this.pool.query<FilaFlujo[]>(
      `select bin_to_uuid(f.id) as id, f.nombre, f.estado, bin_to_uuid(f.version_activa_id) as versionActivaId
         from flujo f where f.id = uuid_to_bin(?)`,
      [id],
    );
    return filas.length ? filas[0]! : null;
  }

  /**
   * HU-052: la definición que hay que dibujar. Si el flujo todavía no tiene versión, el
   * lienzo se muestra vacío (la versión nace con el primer paso).
   */
  async grafo(id: string): Promise<Grafo | null> {
    const flujo = await this.flujo(id);
    if (!flujo) return null;
    // Si hay un borrador (la primera versión o una nueva sobre un flujo publicado, HU-078),
    // es lo que se dibuja y se edita; si no, la versión que está en operación.
    const version =
      (await this.versionBorradorDeLectura(flujo.id)) ??
      (flujo.versionActivaId ? await this.versionPorId(flujo.versionActivaId) : null);
    const enOperacion = flujo.versionActivaId ? await this.versionPorId(flujo.versionActivaId) : null;
    if (!version) {
      return {
        flujoId: flujo.id,
        flujo: flujo.nombre,
        estadoFlujo: flujo.estado,
        version: null,
        versionEnOperacion: null,
        editable: flujo.versionActivaId === null,
        pasos: [],
        transiciones: [],
      };
    }
    const [pasos, transiciones, responsables] = await Promise.all([
      this.pasos(version.id),
      this.transiciones(version.id),
      this.responsables(version.id),
    ]);
    return {
      flujoId: flujo.id,
      flujo: flujo.nombre,
      estadoFlujo: flujo.estado,
      version,
      versionEnOperacion: enOperacion?.numero ?? null,
      editable: version.estado === 'BORRADOR',
      pasos: pasos.map((paso) => ({
        ...paso,
        responsables: responsables.filter((r) => r.estadoId === paso.id).map(({ estadoId: _e, ...resto }) => resto),
      })),
      transiciones,
    };
  }

  // --- Escritura de la definición ------------------------------------------------

  /** HU-053: agregar un paso al flujo. */
  async agregarPaso(flujoId: string, datos: PasoCrear, actor: Autor): Promise<string> {
    const id = randomUUID();
    await enTransaccion(this.pool, async (cx) => {
      const version = await this.versionEditable(cx, flujoId, actor);
      if (await this.existePaso(cx, version.id, datos.nombre, null)) {
        throw conflicto(`Ya hay un paso llamado «${datos.nombre}» en este flujo.`);
      }
      if (datos.tipo === 'INICIAL') await this.exigirUnicoInicial(cx, version.id, null);

      const [filas] = await cx.query<RowDataPacket[]>(
        `select count(*) as total, coalesce(max(posicion_y), 0) as alto
           from estado_flujo where version_id = uuid_to_bin(?)`,
        [version.id],
      );
      const total = Number(filas[0]!.total);
      const posicionX = datos.posicionX ?? 60 + total * PASO_ANCHO;
      const posicionY = datos.posicionY ?? (total ? Number(filas[0]!.alto) : PASO_ALTO);

      await cx.query(
        `insert into estado_flujo (id, version_id, nombre, descripcion, tipo, posicion_x, posicion_y)
         values (uuid_to_bin(?), uuid_to_bin(?), ?, ?, ?, ?, ?)`,
        [id, version.id, datos.nombre, datos.descripcion ?? null, datos.tipo, posicionX, posicionY],
      );
      await registrarEvento(cx, {
        tipo: 'flujo.paso-agregado',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, versionId: version.id, estadoId: id, nombre: datos.nombre, tipo: datos.tipo },
      });
    });
    return id;
  }

  /** HU-054: corregir el nombre, la descripción o el sitio del paso en el lienzo. */
  async editarPaso(flujoId: string, pasoId: string, datos: PasoEditar, actor: Autor): Promise<void> {
    await enTransaccion(this.pool, async (cx) => {
      const version = await this.versionEditable(cx, flujoId, actor);
      const paso = await this.pasoDeLaVersion(cx, version.id, pasoId);
      const cambios: string[] = [];

      if (datos.nombre !== undefined && datos.nombre !== paso.nombre) {
        if (await this.existePaso(cx, version.id, datos.nombre, pasoId)) {
          throw conflicto(`Ya hay un paso llamado «${datos.nombre}» en este flujo.`);
        }
        cambios.push('nombre');
      }
      if (datos.descripcion !== undefined && datos.descripcion !== paso.descripcion) cambios.push('descripcion');
      const movido =
        (datos.posicionX !== undefined && datos.posicionX !== paso.posicionX) ||
        (datos.posicionY !== undefined && datos.posicionY !== paso.posicionY);
      if (movido) cambios.push('posicion');
      if (!cambios.length) return;

      await cx.query(
        `update estado_flujo
            set nombre = ?, descripcion = ?, posicion_x = ?, posicion_y = ?
          where id = uuid_to_bin(?)`,
        [
          datos.nombre ?? paso.nombre,
          datos.descripcion === undefined ? paso.descripcion : (datos.descripcion ?? null),
          datos.posicionX ?? paso.posicionX,
          datos.posicionY ?? paso.posicionY,
          pasoId,
        ],
      );
      await registrarEvento(cx, {
        // Mover un paso por el lienzo no es un cambio de definición, pero sí de cómo se
        // entiende el flujo: se registra con los mismos datos y sin ruido adicional.
        tipo: 'flujo.paso-editado',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, estadoId: pasoId, nombre: datos.nombre ?? paso.nombre, cambios },
      });
    });
  }

  /** HU-055: marcar el paso como inicial, intermedio o final. */
  async marcarPaso(flujoId: string, pasoId: string, tipo: TipoEstado, actor: Autor): Promise<void> {
    await enTransaccion(this.pool, async (cx) => {
      const version = await this.versionEditable(cx, flujoId, actor);
      const paso = await this.pasoDeLaVersion(cx, version.id, pasoId);
      if (paso.tipo === tipo) return;
      if (tipo === 'INICIAL') await this.exigirUnicoInicial(cx, version.id, pasoId);

      await cx.query('update estado_flujo set tipo = ? where id = uuid_to_bin(?)', [tipo, pasoId]);
      await registrarEvento(cx, {
        tipo: 'flujo.paso-marcado',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, estadoId: pasoId, nombre: paso.nombre, tipoAnterior: paso.tipo, tipo },
      });
    });
  }

  /** HU-054: retirar un paso. Se lleva por delante sus transiciones y sus responsables. */
  async retirarPaso(flujoId: string, pasoId: string, actor: Autor): Promise<void> {
    await enTransaccion(this.pool, async (cx) => {
      const version = await this.versionEditable(cx, flujoId, actor);
      const paso = await this.pasoDeLaVersion(cx, version.id, pasoId);

      const [borradas] = await cx.query<ResultSetHeader>(
        `delete from transicion
          where version_id = uuid_to_bin(?) and (estado_origen_id = uuid_to_bin(?) or estado_destino_id = uuid_to_bin(?))`,
        [version.id, pasoId, pasoId],
      );
      await cx.query('delete from estado_flujo where id = uuid_to_bin(?)', [pasoId]);
      await registrarEvento(cx, {
        tipo: 'flujo.paso-retirado',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, estadoId: pasoId, nombre: paso.nombre, transicionesRetiradas: borradas.affectedRows },
      });
    });
  }

  /** HU-056: crear una transición (acción + paso de origen → paso de destino). */
  async agregarTransicion(flujoId: string, datos: TransicionCrear, actor: Autor): Promise<string> {
    const id = randomUUID();
    await enTransaccion(this.pool, async (cx) => {
      const version = await this.versionEditable(cx, flujoId, actor);
      await this.pasoDeLaVersion(cx, version.id, datos.estadoOrigenId);
      await this.pasoDeLaVersion(cx, version.id, datos.estadoDestinoId);
      await this.exigirAccionLibre(cx, datos.estadoOrigenId, datos.accion, null);

      await cx.query(
        `insert into transicion (id, version_id, estado_origen_id, estado_destino_id, accion, etiqueta)
         values (uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), ?, ?)`,
        [id, version.id, datos.estadoOrigenId, datos.estadoDestinoId, datos.accion, datos.etiqueta ?? null],
      );
      await registrarEvento(cx, {
        tipo: 'flujo.transicion-agregada',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: {
          flujoId,
          transicionId: id,
          accion: datos.accion,
          estadoOrigenId: datos.estadoOrigenId,
          estadoDestinoId: datos.estadoDestinoId,
        },
      });
    });
    return id;
  }

  /** HU-057: cambiar la acción, el destino o el texto de una transición. */
  async editarTransicion(flujoId: string, transicionId: string, datos: TransicionEditar, actor: Autor): Promise<void> {
    await enTransaccion(this.pool, async (cx) => {
      const version = await this.versionEditable(cx, flujoId, actor);
      const transicion = await this.transicionDeLaVersion(cx, version.id, transicionId);
      const cambios: string[] = [];

      if (datos.estadoDestinoId !== undefined && datos.estadoDestinoId !== transicion.estadoDestinoId) {
        await this.pasoDeLaVersion(cx, version.id, datos.estadoDestinoId);
        if (datos.estadoDestinoId === transicion.estadoOrigenId) {
          throw conflicto('El paso de origen y el de destino deben ser distintos.');
        }
        cambios.push('destino');
      }
      if (datos.accion !== undefined && datos.accion !== transicion.accion) {
        await this.exigirAccionLibre(cx, transicion.estadoOrigenId, datos.accion, transicionId);
        cambios.push('accion');
      }
      if (datos.etiqueta !== undefined && (datos.etiqueta ?? null) !== transicion.etiqueta) cambios.push('etiqueta');
      if (!cambios.length) return;

      await cx.query(
        `update transicion set estado_destino_id = uuid_to_bin(?), accion = ?, etiqueta = ? where id = uuid_to_bin(?)`,
        [
          datos.estadoDestinoId ?? transicion.estadoDestinoId,
          datos.accion ?? transicion.accion,
          datos.etiqueta === undefined ? transicion.etiqueta : (datos.etiqueta ?? null),
          transicionId,
        ],
      );
      await registrarEvento(cx, {
        tipo: 'flujo.transicion-editada',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, transicionId, accion: datos.accion ?? transicion.accion, cambios },
      });
    });
  }

  /** HU-058: retirar una transición que ya no aplica. */
  async retirarTransicion(flujoId: string, transicionId: string, actor: Autor): Promise<void> {
    await enTransaccion(this.pool, async (cx) => {
      const version = await this.versionEditable(cx, flujoId, actor);
      const transicion = await this.transicionDeLaVersion(cx, version.id, transicionId);
      await cx.query('delete from transicion where id = uuid_to_bin(?)', [transicionId]);
      await registrarEvento(cx, {
        tipo: 'flujo.transicion-retirada',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: {
          flujoId,
          transicionId,
          accion: transicion.accion,
          estadoOrigenId: transicion.estadoOrigenId,
          estadoDestinoId: transicion.estadoDestinoId,
        },
      });
    });
  }

  /** HU-059: asignar un rol, un área, un usuario o un grupo a un paso. */
  async asignarResponsable(
    flujoId: string,
    pasoId: string,
    tipoSujeto: TipoSujeto,
    sujetoId: string,
    actor: Autor,
  ): Promise<string> {
    const id = randomUUID();
    await enTransaccion(this.pool, async (cx) => {
      const version = await this.versionEditable(cx, flujoId, actor);
      await this.pasoDeLaVersion(cx, version.id, pasoId);
      const [filas] = await cx.query<RowDataPacket[]>(
        `select 1 from estado_responsable
          where estado_id = uuid_to_bin(?) and tipo_sujeto = ? and sujeto_id = uuid_to_bin(?) limit 1`,
        [pasoId, tipoSujeto, sujetoId],
      );
      if (filas.length) throw conflicto('Ese responsable ya está asignado a este paso.');

      await cx.query(
        `insert into estado_responsable (id, estado_id, tipo_sujeto, sujeto_id, asignado_por, asignado_en)
         values (uuid_to_bin(?), uuid_to_bin(?), ?, uuid_to_bin(?), uuid_to_bin(?), utc_timestamp(6))`,
        [id, pasoId, tipoSujeto, sujetoId, actor.id],
      );
      await registrarEvento(cx, {
        tipo: 'flujo.responsable-asignado',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, estadoId: pasoId, tipoSujeto, sujetoId },
      });
    });
    return id;
  }

  /** HU-060: quitar un responsable de un paso. */
  async quitarResponsable(flujoId: string, pasoId: string, responsableId: string, actor: Autor): Promise<void> {
    await enTransaccion(this.pool, async (cx) => {
      const version = await this.versionEditable(cx, flujoId, actor);
      await this.pasoDeLaVersion(cx, version.id, pasoId);
      const [filas] = await cx.query<RowDataPacket[]>(
        'select tipo_sujeto as tipoSujeto, bin_to_uuid(sujeto_id) as sujetoId from estado_responsable where id = uuid_to_bin(?) and estado_id = uuid_to_bin(?)',
        [responsableId, pasoId],
      );
      if (!filas.length) throw noEncontrado('Ese responsable no está asignado a este paso.');

      await cx.query('delete from estado_responsable where id = uuid_to_bin(?)', [responsableId]);
      await registrarEvento(cx, {
        tipo: 'flujo.responsable-retirado',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, estadoId: pasoId, tipoSujeto: filas[0]!.tipoSujeto, sujetoId: filas[0]!.sujetoId },
      });
    });
  }

  /**
   * HU-078: abre una versión nueva (en borrador) copiando la que está en operación, para
   * cambiar el flujo sin tocar lo que los trámites en curso siguen usando. La publicada
   * no se modifica: solo se reemplaza cuando el borrador se publica (HU-061).
   */
  async crearVersion(flujoId: string, actor: Autor): Promise<VersionDeTrabajo> {
    let creada!: VersionDeTrabajo;
    await enTransaccion(this.pool, async (cx) => {
      // Bloquea el flujo para que dos peticiones simultáneas no abran dos borradores.
      await cx.query('select id from flujo where id = uuid_to_bin(?) for update', [flujoId]);
      const flujo = await this.flujoDe(cx, flujoId);
      if (!flujo.versionActivaId) {
        throw conflicto('El flujo todavía no tiene una versión publicada: edita el borrador y publícalo.');
      }
      if (flujo.estado === 'INACTIVO') throw conflicto('El flujo está archivado: reactívalo antes de versionarlo.');
      const [borradores] = await cx.query<FilaVersion[]>(
        `select bin_to_uuid(v.id) as id, v.numero, v.estado from flujo_version v
          where v.flujo_id = uuid_to_bin(?) and v.estado = 'BORRADOR' limit 1`,
        [flujoId],
      );
      if (borradores.length) {
        throw conflicto(`Ya hay una versión ${borradores[0]!.numero} en borrador: edítala y publícala.`);
      }

      const origen = flujo.versionActivaId;
      const [siguiente] = await cx.query<RowDataPacket[]>(
        'select coalesce(max(numero), 0) + 1 as numero from flujo_version where flujo_id = uuid_to_bin(?)',
        [flujoId],
      );
      const numero = Number(siguiente[0]!.numero);
      const versionId = randomUUID();
      await cx.query(
        `insert into flujo_version (id, flujo_id, numero, estado, sla_global_minutos, notas, creado_por, creado_en)
         select uuid_to_bin(?), flujo_id, ?, 'BORRADOR', sla_global_minutos, notas, uuid_to_bin(?), utc_timestamp(6)
           from flujo_version where id = uuid_to_bin(?)`,
        [versionId, numero, actor.id, origen],
      );

      // Cada paso copiado recibe un id propio; las transiciones y los responsables se
      // reapuntan a esos ids nuevos.
      const [pasos] = await cx.query<RowDataPacket[]>(
        `select bin_to_uuid(id) as id, nombre, descripcion, tipo, tipo_responsable, sla_minutos,
                requiere_firma, posicion_x, posicion_y
           from estado_flujo where version_id = uuid_to_bin(?)`,
        [origen],
      );
      const nuevoId = new Map<string, string>();
      for (const p of pasos) {
        const id = randomUUID();
        nuevoId.set(p.id, id);
        await cx.query(
          `insert into estado_flujo (id, version_id, nombre, descripcion, tipo, tipo_responsable, sla_minutos,
                                     requiere_firma, posicion_x, posicion_y)
           values (uuid_to_bin(?), uuid_to_bin(?), ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, versionId, p.nombre, p.descripcion, p.tipo, p.tipo_responsable, p.sla_minutos,
           p.requiere_firma, p.posicion_x, p.posicion_y],
        );
      }
      const [transiciones] = await cx.query<RowDataPacket[]>(
        `select bin_to_uuid(estado_origen_id) as origen, bin_to_uuid(estado_destino_id) as destino, accion, etiqueta
           from transicion where version_id = uuid_to_bin(?)`,
        [origen],
      );
      for (const t of transiciones) {
        await cx.query(
          `insert into transicion (id, version_id, estado_origen_id, estado_destino_id, accion, etiqueta)
           values (uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), ?, ?)`,
          [randomUUID(), versionId, nuevoId.get(t.origen), nuevoId.get(t.destino), t.accion, t.etiqueta],
        );
      }
      const [responsables] = await cx.query<RowDataPacket[]>(
        `select bin_to_uuid(r.estado_id) as estado, r.tipo_sujeto, bin_to_uuid(r.sujeto_id) as sujeto,
                bin_to_uuid(r.asignado_por) as asignadoPor, r.asignado_en
           from estado_responsable r join estado_flujo e on e.id = r.estado_id
          where e.version_id = uuid_to_bin(?)`,
        [origen],
      );
      for (const r of responsables) {
        await cx.query(
          `insert into estado_responsable (id, estado_id, tipo_sujeto, sujeto_id, asignado_por, asignado_en)
           values (uuid_to_bin(?), uuid_to_bin(?), ?, uuid_to_bin(?), uuid_to_bin(?), ?)`,
          [randomUUID(), nuevoId.get(r.estado), r.tipo_sujeto, r.sujeto, r.asignadoPor, r.asignado_en],
        );
      }

      await registrarEvento(cx, {
        tipo: 'flujo.version_creada',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, versionId, numero, copiadaDeId: origen, pasos: pasos.length },
      });
      creada = { id: versionId, numero, estado: 'BORRADOR' };
    });
    return creada;
  }

  /** HU-061: la versión en borrador queda publicada y pasa a ser la que usan los trámites. */
  async publicar(flujoId: string, actor: Autor): Promise<{ version: VersionDeTrabajo; pasos: number }> {
    let publicada: { version: VersionDeTrabajo; pasos: number } | null = null;
    await enTransaccion(this.pool, async (cx) => {
      await this.flujoDe(cx, flujoId);
      const version = await this.versionBorradorRequerida(cx, flujoId);
      const [cuenta] = await cx.query<RowDataPacket[]>(
        'select count(*) as total from estado_flujo where version_id = uuid_to_bin(?)',
        [version.id],
      );

      // La versión que estaba en operación queda reemplazada, para poder reconstruir la
      // historia de la definición (HU-078).
      await cx.query(
        `update flujo_version set estado = 'REEMPLAZADA'
          where flujo_id = uuid_to_bin(?) and estado = 'PUBLICADA'`,
        [flujoId],
      );
      await cx.query(
        `update flujo_version
            set estado = 'PUBLICADA', publicado_por = uuid_to_bin(?), publicado_en = utc_timestamp(6)
          where id = uuid_to_bin(?)`,
        [actor.id, version.id],
      );
      await cx.query(
        `update flujo
            set estado = 'ACTIVO', version_activa_id = uuid_to_bin(?),
                actualizado_por = uuid_to_bin(?), actualizado_en = utc_timestamp(6)
          where id = uuid_to_bin(?)`,
        [version.id, actor.id, flujoId],
      );
      await registrarEvento(cx, {
        tipo: 'flujo.publicado',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, versionId: version.id, numero: version.numero, pasos: Number(cuenta[0]!.total) },
      });
      publicada = { version, pasos: Number(cuenta[0]!.total) };
    });
    return publicada!;
  }

  /**
   * HU-050: trámites de este flujo que aún no terminan. Todavía no existen trámites
   * (HU-062), así que no hay nada que contar; al crear esa tabla, la consulta va aquí.
   */
  private async contarTramitesEnCurso(_cx: PoolConnection, _flujoId: string): Promise<number> {
    return 0;
  }

  /** HU-050: archivar un flujo para retirar circuitos obsoletos sin borrar su historia. */
  async desactivar(flujoId: string, actor: Autor): Promise<void> {
    await enTransaccion(this.pool, async (cx) => {
      const flujo = await this.flujoDe(cx, flujoId);
      if (flujo.estado === 'INACTIVO') throw conflicto('El flujo ya está archivado.');
      const enCurso = await this.contarTramitesEnCurso(cx, flujoId);
      if (enCurso > 0) {
        throw conflicto(
          `No se puede archivar: el flujo tiene ${enCurso} trámite${enCurso === 1 ? '' : 's'} en curso.`,
        );
      }
      await cx.query(
        `update flujo set estado = 'INACTIVO', actualizado_por = uuid_to_bin(?), actualizado_en = utc_timestamp(6)
          where id = uuid_to_bin(?)`,
        [actor.id, flujoId],
      );
      await registrarEvento(cx, {
        tipo: 'flujo.desactivado',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, estadoAnterior: flujo.estado },
      });
    });
  }

  /** HU-050: devolver a la operación un flujo archivado. */
  async reactivar(flujoId: string, actor: Autor): Promise<void> {
    await enTransaccion(this.pool, async (cx) => {
      const flujo = await this.flujoDe(cx, flujoId);
      if (flujo.estado !== 'INACTIVO') throw conflicto('El flujo no está archivado.');
      const estado = flujo.versionActivaId ? 'ACTIVO' : 'BORRADOR';
      await cx.query(
        `update flujo set estado = ?, actualizado_por = uuid_to_bin(?), actualizado_en = utc_timestamp(6)
          where id = uuid_to_bin(?)`,
        [estado, actor.id, flujoId],
      );
      await registrarEvento(cx, {
        tipo: 'flujo.reactivado',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, estado },
      });
    });
  }

  // --- Piezas internas -----------------------------------------------------------

  private async flujoDe(cx: PoolConnection, id: string): Promise<FilaFlujo> {
    const [filas] = await cx.query<FilaFlujo[]>(
      `select bin_to_uuid(f.id) as id, f.nombre, f.estado, bin_to_uuid(f.version_activa_id) as versionActivaId
         from flujo f where f.id = uuid_to_bin(?)`,
      [id],
    );
    if (!filas.length) throw noEncontrado('No existe un flujo con ese identificador.');
    return filas[0]!;
  }

  /**
   * Devuelve la versión que se puede editar. Si el flujo todavía no tiene ninguna, la
   * crea; si ya tiene una publicada, la definición queda bloqueada.
   */
  private async versionEditable(cx: PoolConnection, flujoId: string, actor: Autor): Promise<FilaVersion> {
    const flujo = await this.flujoDe(cx, flujoId);
    const [filas] = await cx.query<FilaVersion[]>(
      `select bin_to_uuid(v.id) as id, v.numero, v.estado
         from flujo_version v
        where v.flujo_id = uuid_to_bin(?) and v.estado = 'BORRADOR'
        order by v.numero desc limit 1`,
      [flujoId],
    );
    if (filas.length) return filas[0]!;

    if (flujo.versionActivaId) {
      throw conflicto(
        'Este flujo ya está publicado: su recorrido no se edita mientras esté en operación. ' +
          'Para cambiarlo, crea una versión nueva (POST /flujos/{id}/versiones).',
      );
    }

    const id = randomUUID();
    const [siguiente] = await cx.query<RowDataPacket[]>(
      'select coalesce(max(numero), 0) + 1 as numero from flujo_version where flujo_id = uuid_to_bin(?)',
      [flujoId],
    );
    const numero = Number(siguiente[0]!.numero);
    await cx.query(
      `insert into flujo_version (id, flujo_id, numero, estado, creado_por, creado_en)
       values (uuid_to_bin(?), uuid_to_bin(?), ?, 'BORRADOR', uuid_to_bin(?), utc_timestamp(6))`,
      [id, flujoId, numero, actor.id],
    );
    return { id, numero, estado: 'BORRADOR' } as FilaVersion;
  }

  private async versionBorradorRequerida(cx: PoolConnection, flujoId: string): Promise<FilaVersion> {
    const [filas] = await cx.query<FilaVersion[]>(
      `select bin_to_uuid(v.id) as id, v.numero, v.estado
         from flujo_version v
        where v.flujo_id = uuid_to_bin(?) and v.estado = 'BORRADOR'
        order by v.numero desc limit 1`,
      [flujoId],
    );
    if (!filas.length) throw conflicto('El flujo no tiene una versión en borrador que publicar.');
    return filas[0]!;
  }

  private async versionBorradorDeLectura(flujoId: string): Promise<FilaVersion | null> {
    const [filas] = await this.pool.query<FilaVersion[]>(
      `select bin_to_uuid(v.id) as id, v.numero, v.estado
         from flujo_version v
        where v.flujo_id = uuid_to_bin(?) and v.estado = 'BORRADOR'
        order by v.numero desc limit 1`,
      [flujoId],
    );
    return filas.length ? filas[0]! : null;
  }

  private async versionPorId(id: string): Promise<FilaVersion | null> {
    const [filas] = await this.pool.query<FilaVersion[]>(
      'select bin_to_uuid(v.id) as id, v.numero, v.estado from flujo_version v where v.id = uuid_to_bin(?)',
      [id],
    );
    return filas.length ? filas[0]! : null;
  }

  /** El paso tiene que ser de esta versión: así no se mezclan flujos distintos. */
  private async pasoDeLaVersion(cx: PoolConnection, versionId: string, pasoId: string): Promise<FilaPaso> {
    const [filas] = await cx.query<FilaPaso[]>(
      `select bin_to_uuid(e.id) as id, e.nombre, e.descripcion, e.tipo,
              e.posicion_x as posicionX, e.posicion_y as posicionY
         from estado_flujo e
        where e.id = uuid_to_bin(?) and e.version_id = uuid_to_bin(?)`,
      [pasoId, versionId],
    );
    if (!filas.length) throw noEncontrado('Ese paso no pertenece a este flujo.');
    return filas[0]!;
  }

  private async transicionDeLaVersion(
    cx: PoolConnection,
    versionId: string,
    transicionId: string,
  ): Promise<FilaTransicion> {
    const [filas] = await cx.query<FilaTransicion[]>(
      `select bin_to_uuid(t.id) as id, bin_to_uuid(t.estado_origen_id) as estadoOrigenId,
              bin_to_uuid(t.estado_destino_id) as estadoDestinoId, t.accion, t.etiqueta
         from transicion t
        where t.id = uuid_to_bin(?) and t.version_id = uuid_to_bin(?)`,
      [transicionId, versionId],
    );
    if (!filas.length) throw noEncontrado('Esa transición no pertenece a este flujo.');
    return filas[0]!;
  }

  private async existePaso(
    cx: PoolConnection,
    versionId: string,
    nombre: string,
    exceptoId: string | null,
  ): Promise<boolean> {
    const [filas] = await cx.query<RowDataPacket[]>(
      `select 1 from estado_flujo
        where version_id = uuid_to_bin(?) and nombre = ? and (? is null or id <> uuid_to_bin(?)) limit 1`,
      [versionId, nombre, exceptoId, exceptoId],
    );
    return filas.length > 0;
  }

  /** HU-055: el flujo tiene un solo punto de partida. */
  private async exigirUnicoInicial(cx: PoolConnection, versionId: string, exceptoId: string | null): Promise<void> {
    const [filas] = await cx.query<RowDataPacket[]>(
      `select nombre from estado_flujo
        where version_id = uuid_to_bin(?) and tipo = 'INICIAL' and (? is null or id <> uuid_to_bin(?)) limit 1`,
      [versionId, exceptoId, exceptoId],
    );
    if (filas.length) {
      throw conflicto(`Ya hay un paso inicial: «${filas[0]!.nombre}». Solo puede haber uno.`);
    }
  }

  /** Un paso no puede repetir la misma acción (la base también lo impide). */
  private async exigirAccionLibre(
    cx: PoolConnection,
    pasoId: string,
    accion: string,
    exceptoId: string | null,
  ): Promise<void> {
    const [filas] = await cx.query<RowDataPacket[]>(
      `select 1 from transicion
        where estado_origen_id = uuid_to_bin(?) and accion = ? and (? is null or id <> uuid_to_bin(?)) limit 1`,
      [pasoId, accion, exceptoId, exceptoId],
    );
    if (filas.length) {
      throw conflicto(`Ese paso ya tiene definida la acción ${accion.toLowerCase()}.`);
    }
  }

  private async pasos(versionId: string): Promise<Omit<Paso, 'responsables'>[]> {
    const [filas] = await this.pool.query<FilaPaso[]>(
      `select bin_to_uuid(e.id) as id, e.nombre, e.descripcion, e.tipo,
              e.posicion_x as posicionX, e.posicion_y as posicionY
         from estado_flujo e
        where e.version_id = uuid_to_bin(?)
        order by e.posicion_x asc, e.posicion_y asc, e.nombre asc`,
      [versionId],
    );
    return filas;
  }

  private async transiciones(versionId: string): Promise<Transicion[]> {
    const [filas] = await this.pool.query<FilaTransicion[]>(
      `select bin_to_uuid(t.id) as id, bin_to_uuid(t.estado_origen_id) as estadoOrigenId,
              bin_to_uuid(t.estado_destino_id) as estadoDestinoId, t.accion, t.etiqueta
         from transicion t
        where t.version_id = uuid_to_bin(?)
        order by t.accion asc`,
      [versionId],
    );
    return filas;
  }

  private async responsables(versionId: string): Promise<(Responsable & { estadoId: string })[]> {
    const [filas] = await this.pool.query<FilaResponsable[]>(
      `select bin_to_uuid(r.id) as id, bin_to_uuid(r.estado_id) as estadoId,
              r.tipo_sujeto as tipoSujeto, bin_to_uuid(r.sujeto_id) as sujetoId
         from estado_responsable r
         join estado_flujo e on e.id = r.estado_id
        where e.version_id = uuid_to_bin(?)
        order by r.asignado_en asc`,
      [versionId],
    );
    return filas;
  }
}
