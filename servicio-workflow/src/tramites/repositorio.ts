import { Inject, Injectable } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import type { Autor } from '../bandeja';
import { enTransaccion, registrarEvento } from '../bandeja';
import { POOL } from '../db';
import { conflicto, noProcesable } from '../errores';
import type { FlujoDisponible, IniciarTramite, Tramite } from './modelo';

const DUPLICADO = 1062;

interface FilaTramite extends RowDataPacket, Omit<Tramite, 'iniciadoEn'> {
  iniciadoEn: Date;
}

const SELECT_TRAMITE = `select bin_to_uuid(t.id) as id,
       bin_to_uuid(t.radicado_id) as radicadoId,
       t.radicado_codigo as radicadoCodigo,
       bin_to_uuid(t.flujo_id) as flujoId,
       f.nombre as flujoNombre,
       bin_to_uuid(t.version_id) as versionId,
       bin_to_uuid(t.estado_actual_id) as estadoActualId,
       e.nombre as estadoActual,
       t.estado,
       t.iniciado_en as iniciadoEn
  from tramite t
  join flujo f on f.id = t.flujo_id
  join estado_flujo e on e.id = t.estado_actual_id`;

/** Vínculo flujo ↔ tipo documental y arranque de trámites. */
@Injectable()
export class RepositorioTramites {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  async existeFlujo(flujoId: string): Promise<boolean> {
    const [filas] = await this.pool.query<RowDataPacket[]>('select 1 from flujo where id = uuid_to_bin(?)', [flujoId]);
    return filas.length > 0;
  }

  async tiposDelFlujo(flujoId: string): Promise<string[]> {
    const [filas] = await this.pool.query<RowDataPacket[]>(
      `select bin_to_uuid(tipo_documental_id) as id from flujo_tipo_documental
        where flujo_id = uuid_to_bin(?) order by asociado_en, tipo_documental_id`,
      [flujoId],
    );
    return filas.map((fila) => fila['id'] as string);
  }

  /** Reemplaza los tipos del flujo por la lista recibida, en una sola transacción. */
  async reemplazarTipos(flujoId: string, tipoIds: string[], actor: Autor): Promise<void> {
    await enTransaccion(this.pool, async (cx) => {
      await cx.query('delete from flujo_tipo_documental where flujo_id = uuid_to_bin(?)', [flujoId]);
      for (const tipoId of tipoIds) {
        await cx.query(
          `insert into flujo_tipo_documental (flujo_id, tipo_documental_id, asociado_por, asociado_en)
           values (uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), utc_timestamp(6))`,
          [flujoId, tipoId, actor.id],
        );
      }
      await registrarEvento(cx, {
        tipo: 'flujo.tipos-documentales-actualizados',
        entidad: 'flujo',
        entidadId: flujoId,
        actor,
        detalle: { flujoId, tipoDocumentalIds: tipoIds },
      });
    });
  }

  /** Flujos activos, con versión publicada, que atienden ese tipo documental. */
  async disponibles(tipoDocumentalId: string): Promise<FlujoDisponible[]> {
    const [filas] = await this.pool.query<(RowDataPacket & FlujoDisponible)[]>(
      `select bin_to_uuid(f.id) as id, f.nombre, f.descripcion, bin_to_uuid(f.version_activa_id) as versionId
         from flujo f
         join flujo_tipo_documental t on t.flujo_id = f.id
        where t.tipo_documental_id = uuid_to_bin(?) and f.estado = 'ACTIVO' and f.version_activa_id is not null
        order by f.nombre`,
      [tipoDocumentalId],
    );
    return filas;
  }

  async porRadicado(radicadoId: string): Promise<Tramite | null> {
    const [filas] = await this.pool.query<FilaTramite[]>(`${SELECT_TRAMITE} where t.radicado_id = uuid_to_bin(?)`, [radicadoId]);
    return filas.length ? aTramite(filas[0]!) : null;
  }

  /** El trámite nace en el paso inicial de la versión publicada del flujo. */
  async iniciar(datos: IniciarTramite, versionId: string, actor: Autor): Promise<Tramite> {
    const id = randomUUID();
    try {
      await enTransaccion(this.pool, async (cx) => {
        const [inicial] = await cx.query<RowDataPacket[]>(
          `select bin_to_uuid(id) as id from estado_flujo where version_id = uuid_to_bin(?) and tipo = 'INICIAL'`,
          [versionId],
        );
        if (!inicial.length) throw noProcesable('El flujo no tiene un paso inicial: no se puede iniciar el trámite.');
        await cx.query(
          `insert into tramite (id, radicado_id, radicado_codigo, flujo_id, version_id, estado_actual_id, estado, iniciado_por, iniciado_en)
           values (uuid_to_bin(?), uuid_to_bin(?), ?, uuid_to_bin(?), uuid_to_bin(?), uuid_to_bin(?), 'EN_CURSO', uuid_to_bin(?), utc_timestamp(6))`,
          [id, datos.radicadoId, datos.radicadoCodigo, datos.flujoId, versionId, inicial[0]!['id'], actor.id],
        );
        await registrarEvento(cx, {
          tipo: 'tramite.iniciado',
          entidad: 'tramite',
          entidadId: id,
          actor,
          detalle: { tramiteId: id, radicadoId: datos.radicadoId, radicadoCodigo: datos.radicadoCodigo, flujoId: datos.flujoId },
        });
      });
    } catch (error: any) {
      if (error?.errno === DUPLICADO) throw conflicto('Ese radicado ya tiene un trámite en curso.');
      throw error;
    }
    const [filas] = await this.pool.query<FilaTramite[]>(`${SELECT_TRAMITE} where t.id = uuid_to_bin(?)`, [id]);
    return aTramite(filas[0]!);
  }
}

function aTramite(fila: FilaTramite): Tramite {
  return { ...fila, iniciadoEn: fila.iniciadoEn.toISOString() };
}
