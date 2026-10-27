import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { enTransaccion, registrarEvento, type Autor } from '../bandeja';
import { POOL } from '../db';
import { conflicto, noEncontrado } from '../errores';
import type { Accion } from '../disenador/modelo';
import type {
  AccionDisponible,
  MovimientoTramite,
  ResponsablePaso,
  TareaBandeja,
  TramiteDetalle,
} from './modelo';
import { esResponsable } from './modelo';

/** UUID nulo: se usa para que un actor sin área no coincida con ningún responsable. */
const SIN_UUID = '00000000-0000-0000-0000-000000000000';

interface FilaFlujo extends RowDataPacket {
  id: string;
  nombre: string;
  versionId: string;
  sla: number | null;
}

interface FilaPaso extends RowDataPacket {
  id: string;
  nombre: string;
  tipo: string;
  slaMinutos: number | null;
}

interface FilaTramite extends RowDataPacket {
  id: string;
  radicadoId: string;
  radicadoCodigo: string;
  radicadoAsunto: string;
  flujoId: string;
  flujoNombre: string;
  versionId: string;
  estado: string;
  estadoActualId: string;
  iniciadoEn: Date;
  venceEn: Date | null;
  finalizadoEn: Date | null;
}

interface FilaTarea extends RowDataPacket {
  id: string;
  tramiteId: string;
  estado: string;
  asignadaA: string | null;
  tomadaEn: Date | null;
  creadaEn: Date;
  venceEn: Date | null;
  pasoId: string;
  pasoNombre: string;
  pasoTipo: string;
  estadoFlujoId: string;
}

interface FilaBandeja extends FilaTarea {
  radicadoId: string;
  radicadoCodigo: string;
  radicadoAsunto: string;
  flujoId: string;
  flujoNombre: string;
}

interface FilaResponsable extends RowDataPacket {
  estadoId: string;
  tipoSujeto: ResponsablePaso['tipoSujeto'];
  sujetoId: string;
}

interface FilaTransicion extends RowDataPacket {
  transicionId: string;
  origenId: string;
  destinoId: string;
  accion: Accion;
  etiqueta: string | null;
  destinoNombre: string;
}

interface FilaMovimiento extends RowDataPacket {
  id: string;
  accion: string;
  observacion: string | null;
  usuarioId: string;
  usuarioCorreo: string | null;
  ocurridoEn: Date;
  origen: string | null;
  destino: string;
}

function sumarMinutos(base: Date, minutos: number | null | undefined): Date | null {
  if (!minutos || minutos <= 0) return null;
  return new Date(base.getTime() + minutos * 60_000);
}

/** El vencimiento de una tarea nunca supera el del trámite completo (HU-072, HU-073). */
function vencimiento(ahora: Date, minutos: number | null, limite: Date | null): Date | null {
  const propio = sumarMinutos(ahora, minutos);
  if (!propio) return limite;
  if (!limite) return propio;
  return propio < limite ? propio : limite;
}

const marcadores = (ids: string[]): string => ids.map(() => 'uuid_to_bin(?)').join(', ');

@Injectable()
export class RepositorioTramites {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  async flujoActivo(flujoId: string): Promise<FilaFlujo | null> {
    const [filas] = await this.pool.query<FilaFlujo[]>(
      `select bin_to_uuid(f.id) as id, f.nombre, bin_to_uuid(f.version_activa_id) as versionId,
              fv.sla_global_minutos as sla
         from flujo f
         join flujo_version fv on fv.id = f.version_activa_id
        where f.id = uuid_to_bin(?) and f.estado = 'ACTIVO' and fv.estado = 'PUBLICADA'`,
      [flujoId],
    );
    return filas.length ? filas[0]! : null;
  }

  async estadoInicial(versionId: string): Promise<FilaPaso | null> {
    const [filas] = await this.pool.query<FilaPaso[]>(
      `select bin_to_uuid(id) as id, nombre, tipo, sla_minutos as slaMinutos
         from estado_flujo where version_id = uuid_to_bin(?) and tipo = 'INICIAL' limit 1`,
      [versionId],
    );
    return filas.length ? filas[0]! : null;
  }

  async nombreFlujo(flujoId: string): Promise<string | null> {
    const [filas] = await this.pool.query<RowDataPacket[]>('select nombre from flujo where id = uuid_to_bin(?)', [flujoId]);
    return filas.length ? (filas[0] as any).nombre : null;
  }

  /** Flujos en operación, con el nombre y el SLA global de su versión publicada. */
  async flujosPublicados(): Promise<{ id: string; nombre: string; descripcion: string | null; slaGlobal: number | null }[]> {
    const [filas] = await this.pool.query<RowDataPacket[]>(
      `select bin_to_uuid(f.id) as id, f.nombre, f.descripcion, fv.sla_global_minutos as slaGlobal
         from flujo f join flujo_version fv on fv.id = f.version_activa_id
        where f.estado = 'ACTIVO' and fv.estado = 'PUBLICADA'
        order by f.nombre`,
    );
    return filas as any;
  }

  /** HU-062: abre el trámite, deja el movimiento de inicio y la primera tarea. */
  async crear(
    datos: {
      radicadoId: string;
      radicadoCodigo: string;
      radicadoAsunto: string;
      flujoId: string;
      flujoNombre: string;
      versionId: string;
      estadoInicial: FilaPaso;
      slaGlobal: number | null;
    },
    actor: Autor,
  ): Promise<string> {
    const id = randomUUID();
    const ahora = new Date();
    await enTransaccion(this.pool, async (cx) => {
      try {
        await cx.query(
          `insert into tramite (id, radicado_id, radicado_codigo, radicado_asunto, flujo_id, flujo_nombre,
             flujo_version_id, estado_actual_id, estado, iniciado_por, iniciado_en, vence_en)
           values (uuid_to_bin(?), uuid_to_bin(?), ?, ?, uuid_to_bin(?), ?, uuid_to_bin(?), uuid_to_bin(?),
                   'EN_CURSO', uuid_to_bin(?), ?, ?)`,
          [
            id, datos.radicadoId, datos.radicadoCodigo, datos.radicadoAsunto, datos.flujoId, datos.flujoNombre,
            datos.versionId, datos.estadoInicial.id, actor.id, ahora, sumarMinutos(ahora, datos.slaGlobal),
          ],
        );
      } catch (error: any) {
        if (error?.errno === 1062) throw conflicto('Ese radicado ya tiene un trámite en curso.');
        throw error;
      }
      await cx.query(
        `insert into movimiento_tramite
           (id, tramite_id, transicion_id, estado_origen_id, estado_destino_id, accion, observacion,
            usuario_id, usuario_correo, ocurrido_en)
         values (uuid_to_bin(?), uuid_to_bin(?), null, null, uuid_to_bin(?), 'INICIAR', null,
                 uuid_to_bin(?), ?, ?)`,
        [randomUUID(), id, datos.estadoInicial.id, actor.id, actor.correo, ahora],
      );
      await this.crearTarea(cx, id, datos.estadoInicial, ahora, sumarMinutos(ahora, datos.slaGlobal));
      await registrarEvento(cx, {
        tipo: 'tramite.iniciado',
        entidad: 'tramite',
        entidadId: id,
        actor,
        detalle: { tramiteId: id, radicadoId: datos.radicadoId, flujoId: datos.flujoId, paso: datos.estadoInicial.id },
      });
    });
    return id;
  }

  private async crearTarea(
    cx: PoolConnection,
    tramiteId: string,
    paso: FilaPaso,
    ahora: Date,
    limite: Date | null,
  ): Promise<void> {
    await cx.query(
      `insert into tarea (id, tramite_id, estado_flujo_id, estado, creada_en, vence_en)
       values (uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), 'PENDIENTE', ?, ?)`,
      [randomUUID(), tramiteId, paso.id, ahora, vencimiento(ahora, paso.slaMinutos, limite)],
    );
  }

  /** HU-063: tareas abiertas que el actor puede atender, con su paso y su radicado. */
  async bandeja(actor: { id: string; areaId?: string; rolesIds: string[] }, verTodas: boolean): Promise<TareaBandeja[]> {
    const roles = actor.rolesIds.filter(Boolean);
    const delRol = roles.length ? `or (er.tipo_sujeto = 'ROL' and er.sujeto_id in (${marcadores(roles)}))` : '';
    const [filas] = await this.pool.query<FilaBandeja[]>(
      `select bin_to_uuid(ta.id) as id, bin_to_uuid(ta.tramite_id) as tramiteId, ta.estado,
              bin_to_uuid(ta.asignada_a) as asignadaA, ta.tomada_en as tomadaEn, ta.creada_en as creadaEn,
              ta.vence_en as venceEn, bin_to_uuid(es.id) as pasoId, es.nombre as pasoNombre, es.tipo as pasoTipo,
              bin_to_uuid(es.id) as estadoFlujoId,
              bin_to_uuid(tr.radicado_id) as radicadoId, tr.radicado_codigo as radicadoCodigo,
              tr.radicado_asunto as radicadoAsunto, bin_to_uuid(tr.flujo_id) as flujoId, tr.flujo_nombre as flujoNombre
         from tarea ta
         join tramite tr on tr.id = ta.tramite_id
         join estado_flujo es on es.id = ta.estado_flujo_id
        where ta.estado in ('PENDIENTE', 'TOMADA')
          and (
            ta.asignada_a = uuid_to_bin(?)
            or ? = 1
            or not exists (select 1 from estado_responsable er0 where er0.estado_id = ta.estado_flujo_id)
            or exists (
              select 1 from estado_responsable er
               where er.estado_id = ta.estado_flujo_id
                 and (
                   (er.tipo_sujeto = 'USUARIO' and er.sujeto_id = uuid_to_bin(?))
                   ${delRol}
                   or (er.tipo_sujeto = 'AREA' and er.sujeto_id = uuid_to_bin(?))
                 )
            )
          )
        order by (ta.vence_en is null), ta.vence_en asc, ta.creada_en asc`,
      [actor.id, verTodas ? 1 : 0, actor.id, ...roles, actor.areaId ?? SIN_UUID],
    );
    return this.completarTareas(filas, actor, verTodas);
  }

  /** Añade responsables y acciones a las filas, con una sola consulta por bloque. */
  private async completarTareas(
    filas: FilaTarea[],
    actor: { id: string; areaId?: string; rolesIds: string[] },
    verTodas: boolean,
  ): Promise<TareaBandeja[]> {
    if (!filas.length) return [];
    const pasos = [...new Set(filas.map((fila) => fila.pasoId))];
    const [responsables, transiciones] = await Promise.all([
      this.responsables(pasos),
      this.transiciones(pasos),
    ]);
    return filas.map((fila) => this.aTarea(fila, responsables, transiciones, actor, verTodas));
  }

  private aTarea(
    fila: FilaTarea,
    responsables: FilaResponsable[],
    transiciones: FilaTransicion[],
    actor: { id: string; areaId?: string; rolesIds: string[] },
    verTodas: boolean,
  ): TareaBandeja {
    const suyos = responsables.filter((r) => r.estadoId === fila.pasoId).map(({ estadoId: _e, ...resto }) => resto);
    const atiende = esResponsable(actor, suyos);
    const asignadaA = fila.asignadaA;
    const asignadaAOtro = Boolean(asignadaA && asignadaA !== actor.id);
    return {
      id: fila.id,
      tramiteId: fila.tramiteId,
      radicadoId: (fila as FilaBandeja).radicadoId,
      radicadoCodigo: (fila as FilaBandeja).radicadoCodigo,
      radicadoAsunto: (fila as FilaBandeja).radicadoAsunto,
      flujoId: (fila as FilaBandeja).flujoId,
      flujoNombre: (fila as FilaBandeja).flujoNombre,
      paso: { id: fila.pasoId, nombre: fila.pasoNombre, tipo: fila.pasoTipo },
      estado: fila.estado as 'PENDIENTE' | 'TOMADA',
      asignadaA,
      tomadaEn: fila.tomadaEn,
      creadaEn: fila.creadaEn,
      venceEn: fila.venceEn,
      vencida: Boolean(fila.venceEn && new Date(fila.venceEn).getTime() < Date.now()),
      esMia: asignadaA === actor.id,
      supervision: verTodas && !atiende,
      responsables: suyos,
      acciones: asignadaAOtro
        ? []
        : transiciones
            .filter((t) => t.origenId === fila.pasoId)
            .map((t) => ({
              transicionId: t.transicionId,
              accion: t.accion,
              etiqueta: t.etiqueta ?? t.accion.charAt(0) + t.accion.slice(1).toLowerCase(),
              destinoId: t.destinoId,
              destinoNombre: t.destinoNombre,
            })),
    };
  }

  private async responsables(pasos: string[]): Promise<FilaResponsable[]> {
    const [filas] = await this.pool.query<FilaResponsable[]>(
      `select bin_to_uuid(estado_id) as estadoId, tipo_sujeto as tipoSujeto, bin_to_uuid(sujeto_id) as sujetoId
         from estado_responsable where estado_id in (${marcadores(pasos)})`,
      pasos,
    );
    return filas;
  }

  private async transiciones(pasos: string[]): Promise<FilaTransicion[]> {
    const [filas] = await this.pool.query<FilaTransicion[]>(
      `select bin_to_uuid(t.id) as transicionId, bin_to_uuid(t.estado_origen_id) as origenId,
              bin_to_uuid(t.estado_destino_id) as destinoId, t.accion, t.etiqueta, d.nombre as destinoNombre
         from transicion t
         join estado_flujo d on d.id = t.estado_destino_id
        where t.estado_origen_id in (${marcadores(pasos)})
        order by t.accion`,
      pasos,
    );
    return filas;
  }

  async tarea(tareaId: string): Promise<(FilaTarea & { radicadoId: string; radicadoCodigo: string; radicadoAsunto: string; flujoId: string; flujoNombre: string; versionId: string; tramiteEstado: string }) | null> {
    const [filas] = await this.pool.query<any[]>(
      `select bin_to_uuid(ta.id) as id, bin_to_uuid(ta.tramite_id) as tramiteId, ta.estado,
              bin_to_uuid(ta.asignada_a) as asignadaA, ta.tomada_en as tomadaEn, ta.creada_en as creadaEn,
              ta.vence_en as venceEn, bin_to_uuid(es.id) as pasoId, es.nombre as pasoNombre, es.tipo as pasoTipo,
              bin_to_uuid(es.id) as estadoFlujoId,
              bin_to_uuid(tr.radicado_id) as radicadoId, tr.radicado_codigo as radicadoCodigo,
              tr.radicado_asunto as radicadoAsunto, bin_to_uuid(tr.flujo_id) as flujoId, tr.flujo_nombre as flujoNombre,
              bin_to_uuid(tr.flujo_version_id) as versionId, tr.estado as tramiteEstado
         from tarea ta
         join tramite tr on tr.id = ta.tramite_id
         join estado_flujo es on es.id = ta.estado_flujo_id
        where ta.id = uuid_to_bin(?)`,
      [tareaId],
    );
    return filas.length ? filas[0] : null;
  }

  async responsablesDe(paso: string): Promise<ResponsablePaso[]> {
    const filas = await this.responsables([paso]);
    return filas.map(({ estadoId: _e, ...resto }) => resto);
  }

  async accionesDe(paso: string): Promise<AccionDisponible[]> {
    const filas = await this.transiciones([paso]);
    return filas.map((t) => ({
      transicionId: t.transicionId,
      accion: t.accion,
      etiqueta: t.etiqueta ?? t.accion.charAt(0) + t.accion.slice(1).toLowerCase(),
      destinoId: t.destinoId,
      destinoNombre: t.destinoNombre,
    }));
  }

  /** HU-070: tomar la tarea en exclusiva. Dos personas no pueden tomarla a la vez. */
  async tomar(tareaId: string, actor: Autor): Promise<void> {
    await enTransaccion(this.pool, async (cx) => {
      const fila = await this.bloquearTarea(cx, tareaId);
      if (fila.estado === 'TOMADA') {
        if (fila.asignadaA !== actor.id) throw conflicto('Otra persona tomó esta tarea.');
        return;
      }
      if (fila.estado !== 'PENDIENTE') throw conflicto('La tarea ya no está pendiente.');
      await cx.query(
        `update tarea set estado = 'TOMADA', asignada_a = uuid_to_bin(?), tomada_en = ?, version = version + 1
          where id = uuid_to_bin(?)`,
        [actor.id, new Date(), tareaId],
      );
      await cx.query(
        `insert into movimiento_tramite
           (id, tramite_id, tarea_id, transicion_id, estado_origen_id, estado_destino_id, accion, observacion,
            usuario_id, usuario_correo, ocurrido_en)
         values (uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), null, uuid_to_bin(?), uuid_to_bin(?), 'TOMAR', null,
                 uuid_to_bin(?), ?, ?)`,
        [randomUUID(), fila.tramiteId, tareaId, fila.estadoFlujoId, fila.estadoFlujoId, actor.id, actor.correo, new Date()],
      );
      await registrarEvento(cx, {
        tipo: 'tarea.tomada',
        entidad: 'tarea',
        entidadId: tareaId,
        actor,
        detalle: { tareaId, tramiteId: fila.tramiteId },
      });
    });
  }

  /**
   * HU-066…HU-068: ejecuta una transición desde el paso actual. La tarea se completa y
   * el trámite avanza; si el destino es final (o la acción es cancelar) se cierra.
   */
  async ejecutar(
    tareaId: string,
    datos: { accion: Accion; observacion: string | null; transicionId: string; destinoId: string },
    actor: Autor,
  ): Promise<{ tramiteId: string; estado: string; accion: Accion }> {
    return enTransaccion(this.pool, async (cx) => {
      const tarea = await this.bloquearTarea(cx, tareaId);
      if (tarea.estado === 'COMPLETADA' || tarea.estado === 'CANCELADA') {
        throw conflicto('La tarea ya fue atendida.');
      }
      if (tarea.estado === 'TOMADA' && tarea.asignadaA !== actor.id) {
        throw conflicto('Otra persona tomó esta tarea.');
      }
      const tramite = await this.bloquearTramite(cx, tarea.tramiteId);
      if (tramite.estado !== 'EN_CURSO') throw conflicto('El trámite ya está cerrado.');
      if (tramite.estadoActualId !== tarea.estadoFlujoId) {
        throw conflicto('El trámite ya avanzó a otro paso.');
      }

      const [destinos] = await cx.query<RowDataPacket[]>(
        `select bin_to_uuid(id) as id, nombre, tipo, sla_minutos as slaMinutos
           from estado_flujo where id = uuid_to_bin(?) and version_id = uuid_to_bin(?)`,
        [datos.destinoId, tramite.versionId],
      );
      const destino = destinos[0] as (RowDataPacket & { id: string; nombre: string; tipo: string; slaMinutos: number | null }) | undefined;
      if (!destino) throw noEncontrado('El paso de destino no existe en esta versión del flujo.');

      const ahora = new Date();
      await cx.query(
        `update tarea set estado = 'COMPLETADA', completada_en = ?, completada_por = uuid_to_bin(?),
                version = version + 1
          where id = uuid_to_bin(?)`,
        [ahora, actor.id, tareaId],
      );

      const cierra = datos.accion === 'CANCELAR' || destino.tipo === 'FINAL';
      const nuevoEstado = datos.accion === 'CANCELAR' ? 'CANCELADO' : cierra ? 'FINALIZADO' : 'EN_CURSO';

      await cx.query(
        `insert into movimiento_tramite
           (id, tramite_id, tarea_id, transicion_id, estado_origen_id, estado_destino_id, accion, observacion,
            usuario_id, usuario_correo, ocurrido_en)
         values (uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), ?, ?,
                 uuid_to_bin(?), ?, ?)`,
        [
          randomUUID(), tarea.tramiteId, tareaId, datos.transicionId, tramite.estadoActualId,
          destino.id, datos.accion, datos.observacion, actor.id, actor.correo, ahora,
        ],
      );

      if (cierra) {
        await cx.query(
          `update tramite set estado = ?, estado_actual_id = uuid_to_bin(?), finalizado_en = ?, version = version + 1
            where id = uuid_to_bin(?)`,
          [nuevoEstado, destino.id, ahora, tarea.tramiteId],
        );
      } else {
        await cx.query(
          `update tramite set estado_actual_id = uuid_to_bin(?), version = version + 1 where id = uuid_to_bin(?)`,
          [destino.id, tarea.tramiteId],
        );
        await this.crearTarea(cx, tarea.tramiteId, destino as FilaPaso, ahora, tramite.venceEn);
      }

      await registrarEvento(cx, {
        tipo: `tramite.${datos.accion.toLowerCase()}`,
        entidad: 'tramite',
        entidadId: tarea.tramiteId,
        actor,
        detalle: {
          tramiteId: tarea.tramiteId,
          tareaId,
          accion: datos.accion,
          destino: destino?.id ?? null,
          estado: nuevoEstado,
          observacion: datos.observacion,
        },
      });
      return { tramiteId: tarea.tramiteId, estado: nuevoEstado, accion: datos.accion };
    });
  }

  private async bloquearTarea(cx: PoolConnection, tareaId: string): Promise<FilaTarea & { destinoId: string; transicionId: string }> {
    const [filas] = await cx.query<any[]>(
      `select bin_to_uuid(ta.id) as id, bin_to_uuid(ta.tramite_id) as tramiteId, ta.estado,
              bin_to_uuid(ta.asignada_a) as asignadaA, bin_to_uuid(ta.estado_flujo_id) as estadoFlujoId
         from tarea ta where ta.id = uuid_to_bin(?) for update`,
      [tareaId],
    );
    if (!filas.length) throw noEncontrado('La tarea no existe.');
    return filas[0];
  }

  private async bloquearTramite(cx: PoolConnection, tramiteId: string) {
    const [filas] = await cx.query<any[]>(
      `select bin_to_uuid(id) as id, bin_to_uuid(flujo_version_id) as versionId,
              bin_to_uuid(estado_actual_id) as estadoActualId, estado, vence_en as venceEn
         from tramite where id = uuid_to_bin(?) for update`,
      [tramiteId],
    );
    if (!filas.length) throw noEncontrado('El trámite no existe.');
    return filas[0];
  }

  /** Transición concreta desde el paso actual (la escogió el usuario en la bandeja). */
  async transicionDesde(pasoId: string, accion: Accion): Promise<{ id: string; destinoId: string } | null> {
    const [filas] = await this.pool.query<RowDataPacket[]>(
      `select bin_to_uuid(id) as id, bin_to_uuid(estado_destino_id) as destinoId
         from transicion where estado_origen_id = uuid_to_bin(?) and accion = ? limit 1`,
      [pasoId, accion],
    );
    return filas.length ? (filas[0] as any) : null;
  }

  async detalle(tramiteId: string): Promise<TramiteDetalle | null> {
    const [tramites] = await this.pool.query<any[]>(
      `select bin_to_uuid(tr.id) as id, bin_to_uuid(tr.radicado_id) as radicadoId,
              tr.radicado_codigo as radicadoCodigo, tr.radicado_asunto as radicadoAsunto,
              bin_to_uuid(tr.flujo_id) as flujoId, tr.flujo_nombre as flujoNombre, tr.estado,
              tr.iniciado_en as iniciadoEn, tr.vence_en as venceEn, tr.finalizado_en as finalizadoEn,
              bin_to_uuid(tr.estado_actual_id) as estadoActualId, es.nombre as pasoNombre, es.tipo as pasoTipo,
              bin_to_uuid(es.id) as pasoId
         from tramite tr join estado_flujo es on es.id = tr.estado_actual_id
        where tr.id = uuid_to_bin(?)`,
      [tramiteId],
    );
    if (!tramites.length) return null;
    const t = tramites[0];

    const [abiertas] = await this.pool.query<any[]>(
      `select bin_to_uuid(ta.id) as id, bin_to_uuid(ta.tramite_id) as tramiteId, ta.estado,
              bin_to_uuid(ta.asignada_a) as asignadaA, ta.tomada_en as tomadaEn, ta.creada_en as creadaEn,
              ta.vence_en as venceEn, bin_to_uuid(ta.estado_flujo_id) as pasoId, es.nombre as pasoNombre,
              es.tipo as pasoTipo, bin_to_uuid(ta.estado_flujo_id) as estadoFlujoId
         from tarea ta join estado_flujo es on es.id = ta.estado_flujo_id
        where ta.tramite_id = uuid_to_bin(?) and ta.estado in ('PENDIENTE', 'TOMADA')
        limit 1`,
      [tramiteId],
    );

    const [movimientos] = await this.pool.query<FilaMovimiento[]>(
      `select bin_to_uuid(m.id) as id, m.accion, m.observacion, bin_to_uuid(m.usuario_id) as usuarioId,
              m.usuario_correo as usuarioCorreo,
              m.ocurrido_en as ocurridoEn, o.nombre as origen, d.nombre as destino
         from movimiento_tramite m
         left join estado_flujo o on o.id = m.estado_origen_id
         join estado_flujo d on d.id = m.estado_destino_id
        where m.tramite_id = uuid_to_bin(?) order by m.ocurrido_en asc`,
      [tramiteId],
    );

    let tareaAbierta: TareaBandeja | null = null;
    if (abiertas.length) {
      const fila = abiertas[0] as FilaTarea;
      const [responsables, transiciones] = await Promise.all([this.responsables([fila.pasoId]), this.transiciones([fila.pasoId])]);
      tareaAbierta = this.aTarea(
        { ...fila, radicadoId: t.radicadoId, radicadoCodigo: t.radicadoCodigo, radicadoAsunto: t.radicadoAsunto, flujoId: t.flujoId, flujoNombre: t.flujoNombre } as any,
        responsables,
        transiciones,
        // Como el asignado, para no vaciar las acciones de una tarea ya tomada; `ajustar` las recorta por actor.
        { id: fila.asignadaA ?? '', rolesIds: [] },
        false,
      );
      // La vista de detalle no decide por el actor: el servicio recalcula esMia/acciones.
      tareaAbierta.esMia = false;
      tareaAbierta.responsables = responsables.map(({ estadoId: _e, ...resto }) => resto);
    }

    return {
      id: t.id,
      radicadoId: t.radicadoId,
      radicadoCodigo: t.radicadoCodigo,
      radicadoAsunto: t.radicadoAsunto,
      flujoId: t.flujoId,
      flujoNombre: t.flujoNombre,
      estado: t.estado,
      iniciadoEn: t.iniciadoEn,
      venceEn: t.venceEn,
      finalizadoEn: t.finalizadoEn,
      pasoActual: { id: t.pasoId, nombre: t.pasoNombre, tipo: t.pasoTipo },
      tareaAbierta,
      movimientos: movimientos.map((m) => ({
        id: m.id, accion: m.accion, observacion: m.observacion, usuarioId: m.usuarioId,
        usuarioCorreo: m.usuarioCorreo, ocurridoEn: m.ocurridoEn, origen: m.origen, destino: m.destino,
      })),
    };
  }

  /** HU-062: el trámite (en curso o el último cerrado) de un radicado. */
  async porRadicado(radicadoId: string): Promise<TramiteDetalle | null> {
    const [filas] = await this.pool.query<RowDataPacket[]>(
      `select bin_to_uuid(id) as id from tramite where radicado_id = uuid_to_bin(?)
        order by iniciado_en desc limit 1`,
      [radicadoId],
    );
    return filas.length ? this.detalle((filas[0] as any).id) : null;
  }
}

export type { FilaTarea };
