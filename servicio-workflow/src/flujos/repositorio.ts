import { Inject, Injectable } from '@nestjs/common';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import type { Autor } from '../bandeja';
import { enTransaccion, registrarEvento } from '../bandeja';
import { POOL } from '../db';
import type { EventoPendiente } from '../eventos';
import type { EstadoFlujo, FiltrosFlujo, Flujo, NuevoFlujo } from './modelo';

interface FilaFlujo extends RowDataPacket {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: EstadoFlujo;
  versionActivaId: string | null;
  versiones: number;
  creadoEn: Date;
  actualizadoEn: Date | null;
}

interface FilaEvento extends RowDataPacket {
  id: string;
  tipo: string;
  entidad: string;
  entidadId: string | null;
  actorId: string | null;
  actorCorreo: string | null;
  detalle: unknown;
  ocurridoEn: Date;
}

const COLUMNAS = `bin_to_uuid(f.id) as id,
  f.nombre,
  f.descripcion,
  f.estado,
  bin_to_uuid(f.version_activa_id) as versionActivaId,
  (select count(*) from flujo_version v where v.flujo_id = f.id) as versiones,
  f.creado_en as creadoEn,
  f.actualizado_en as actualizadoEn`;

@Injectable()
export class RepositorioFlujos {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  async listar(filtros: FiltrosFlujo): Promise<Flujo[]> {
    const [filas] = await this.pool.query<FilaFlujo[]>(
      `select ${COLUMNAS}
        from flujo f
       where (? is null or f.nombre like concat('%', ?, '%') or f.descripcion like concat('%', ?, '%'))
         and (? is null or f.estado = ?)
       order by f.creado_en desc, f.nombre asc
       limit ? offset ?`,
      [
        filtros.q ?? null,
        filtros.q ?? null,
        filtros.q ?? null,
        filtros.estado ?? null,
        filtros.estado ?? null,
        filtros.tamanio,
        filtros.pagina * filtros.tamanio,
      ],
    );
    return filas.map(aFlujo);
  }

  async contar(filtros: FiltrosFlujo): Promise<number> {
    const [filas] = await this.pool.query<RowDataPacket[]>(
      `select count(*) as total
         from flujo f
        where (? is null or f.nombre like concat('%', ?, '%') or f.descripcion like concat('%', ?, '%'))
          and (? is null or f.estado = ?)`,
      [filtros.q ?? null, filtros.q ?? null, filtros.q ?? null, filtros.estado ?? null, filtros.estado ?? null],
    );
    return Number(filas[0].total);
  }

  async obtener(id: string): Promise<Flujo | null> {
    const [filas] = await this.pool.query<FilaFlujo[]>(
      `select ${COLUMNAS} from flujo f where f.id = uuid_to_bin(?)`,
      [id],
    );
    return filas.length ? aFlujo(filas[0]) : null;
  }

  /** true si otro flujo (distinto de `exceptoId`) ya usa el nombre. */
  async existeNombre(nombre: string, exceptoId: string | null = null): Promise<boolean> {
    const [filas] = await this.pool.query<RowDataPacket[]>(
      'select 1 from flujo where nombre = ? and (? is null or id <> uuid_to_bin(?)) limit 1',
      [nombre, exceptoId, exceptoId],
    );
    return filas.length > 0;
  }

  async crear(datos: NuevoFlujo, actor: Autor): Promise<Flujo> {
    const id = randomUUID();
    await enTransaccion(this.pool, async (cx) => {
      await cx.query(
        `insert into flujo (id, nombre, descripcion, estado, creado_por, creado_en)
         values (uuid_to_bin(?), ?, ?, 'BORRADOR', uuid_to_bin(?), utc_timestamp(6))`,
        [id, datos.nombre, datos.descripcion, actor.id],
      );
      await registrarEvento(cx, {
        tipo: 'flujo.creado',
        entidad: 'flujo',
        entidadId: id,
        actor,
        detalle: { flujoId: id, nombre: datos.nombre, estado: 'BORRADOR' },
      });
    });
    return (await this.obtener(id))!;
  }

  async actualizar(id: string, datos: NuevoFlujo, actor: Autor, cambios: string[]): Promise<Flujo> {
    await enTransaccion(this.pool, async (cx) => {
      await cx.query(
        `update flujo
            set nombre = ?, descripcion = ?, actualizado_por = uuid_to_bin(?), actualizado_en = utc_timestamp(6)
          where id = uuid_to_bin(?)`,
        [datos.nombre, datos.descripcion, actor.id, id],
      );
      await registrarEvento(cx, {
        tipo: 'flujo.editado',
        entidad: 'flujo',
        entidadId: id,
        actor,
        detalle: { flujoId: id, nombre: datos.nombre, cambios },
      });
    });
    return (await this.obtener(id))!;
  }

  async eventosPendientes(limite: number): Promise<EventoPendiente[]> {
    const [filas] = await this.pool.query<FilaEvento[]>(
      `select bin_to_uuid(id) as id, tipo, entidad, entidad_id as entidadId,
              bin_to_uuid(actor_id) as actorId, actor_correo as actorCorreo,
              datos as detalle, ocurrido_en as ocurridoEn
         from evento_saliente
        where estado_publicacion = 'PENDIENTE'
        order by ocurrido_en asc
        limit ?`,
      [limite],
    );
    return filas.map((fila) => ({
      id: fila.id,
      tipo: fila.tipo,
      entidad: fila.entidad,
      entidadId: fila.entidadId,
      actorId: fila.actorId,
      actorCorreo: fila.actorCorreo,
      detalle: fila.detalle,
      ocurridoEn: new Date(fila.ocurridoEn),
    }));
  }

  async marcarPublicados(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const marcadores = ids.map(() => 'uuid_to_bin(?)').join(', ');
    await this.pool.query(
      `update evento_saliente set estado_publicacion = 'PUBLICADO' where id in (${marcadores})`,
      ids,
    );
  }
}

function aFlujo(fila: FilaFlujo): Flujo {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    estado: fila.estado,
    versionActivaId: fila.versionActivaId,
    versiones: Number(fila.versiones),
    creadoEn: new Date(fila.creadoEn).toISOString(),
    actualizadoEn: fila.actualizadoEn ? new Date(fila.actualizadoEn).toISOString() : null,
  };
}
