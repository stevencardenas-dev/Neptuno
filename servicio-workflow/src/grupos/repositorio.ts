import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { enTransaccion, registrarEvento, type Autor } from '../bandeja';
import { POOL } from '../db';
import { conflicto, noEncontrado } from '../errores';
import type { Grupo } from './modelo';

interface FilaGrupo extends RowDataPacket {
  id: string;
  nombre: string;
  descripcion: string | null;
  creadoEn: Date;
}

@Injectable()
export class RepositorioGrupos {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  private async leer(id: string): Promise<Grupo | null> {
    const [filas] = await this.pool.query<FilaGrupo[]>(
      `select bin_to_uuid(id) as id, nombre, descripcion, creado_en as creadoEn
         from grupo_trabajo where id = uuid_to_bin(?)`,
      [id],
    );
    if (!filas.length) return null;
    const [miembros] = await this.pool.query<RowDataPacket[]>(
      `select bin_to_uuid(usuario_id) as usuarioId from grupo_miembro
        where grupo_id = uuid_to_bin(?) order by agregado_en asc`,
      [id],
    );
    return { ...filas[0], miembros: miembros.map((fila) => fila.usuarioId as string) };
  }

  async listar(): Promise<Grupo[]> {
    const [filas] = await this.pool.query<FilaGrupo[]>(
      `select bin_to_uuid(id) as id, nombre, descripcion, creado_en as creadoEn
         from grupo_trabajo order by nombre asc`,
    );
    const grupos = await Promise.all(filas.map((fila) => this.leer(fila.id)));
    return grupos.filter((grupo): grupo is Grupo => grupo !== null);
  }

  async obtener(id: string): Promise<Grupo | null> {
    return this.leer(id);
  }

  async existeNombre(nombre: string, exceptoId: string | null = null): Promise<boolean> {
    const [filas] = await this.pool.query<RowDataPacket[]>(
      'select 1 from grupo_trabajo where nombre = ? and (? is null or id <> uuid_to_bin(?)) limit 1',
      [nombre, exceptoId, exceptoId],
    );
    return filas.length > 0;
  }

  async crear(datos: { nombre: string; descripcion: string | null; miembros: string[] }, actor: Autor): Promise<Grupo> {
    const id = randomUUID();
    try {
      await enTransaccion(this.pool, async (cx) => {
        await cx.query(
          `insert into grupo_trabajo (id, nombre, descripcion, creado_por, creado_en)
           values (uuid_to_bin(?), ?, ?, uuid_to_bin(?), utc_timestamp(6))`,
          [id, datos.nombre, datos.descripcion, actor.id],
        );
        await this.insertarMiembros(cx, id, datos.miembros);
        await registrarEvento(cx, {
          tipo: 'grupo.creado',
          entidad: 'grupo',
          entidadId: id,
          actor,
          detalle: { grupoId: id, nombre: datos.nombre, miembros: datos.miembros.length },
        });
      });
    } catch (error: any) {
      if (error?.errno === 1062) throw conflicto(`Ya existe un grupo llamado «${datos.nombre}».`);
      throw error;
    }
    return (await this.leer(id))!;
  }

  async actualizar(id: string, datos: { nombre: string; descripcion: string | null }, actor: Autor): Promise<Grupo> {
    try {
      await enTransaccion(this.pool, async (cx) => {
        await cx.query(
          'update grupo_trabajo set nombre = ?, descripcion = ? where id = uuid_to_bin(?)',
          [datos.nombre, datos.descripcion, id],
        );
        await registrarEvento(cx, {
          tipo: 'grupo.editado',
          entidad: 'grupo',
          entidadId: id,
          actor,
          detalle: { grupoId: id, nombre: datos.nombre },
        });
      });
    } catch (error: any) {
      if (error?.errno === 1062) throw conflicto(`Ya existe un grupo llamado «${datos.nombre}».`);
      throw error;
    }
    return (await this.leer(id))!;
  }

  async reemplazarMiembros(id: string, usuarios: string[], actor: Autor): Promise<string[]> {
    await enTransaccion(this.pool, async (cx) => {
      await cx.query('delete from grupo_miembro where grupo_id = uuid_to_bin(?)', [id]);
      await this.insertarMiembros(cx, id, usuarios);
      await registrarEvento(cx, {
        tipo: 'grupo.miembros-actualizados',
        entidad: 'grupo',
        entidadId: id,
        actor,
        detalle: { grupoId: id, miembros: usuarios.length },
      });
    });
    return usuarios;
  }

  /** Un grupo en uso no se borra: los pasos que lo tienen asignado quedarían huérfanos. */
  async eliminar(id: string, actor: Autor): Promise<void> {
    const [uso] = await this.pool.query<RowDataPacket[]>(
      `select 1 from estado_responsable where tipo_sujeto = 'GRUPO' and sujeto_id = uuid_to_bin(?) limit 1`,
      [id],
    );
    if (uso.length) throw conflicto('El grupo está asignado a un paso de un flujo: quítalo antes de eliminarlo.');
    await enTransaccion(this.pool, async (cx) => {
      const [resultado] = await cx.query<any>('delete from grupo_trabajo where id = uuid_to_bin(?)', [id]);
      if (!resultado.affectedRows) throw noEncontrado('El grupo no existe.');
      await registrarEvento(cx, {
        tipo: 'grupo.eliminado',
        entidad: 'grupo',
        entidadId: id,
        actor,
        detalle: { grupoId: id },
      });
    });
  }

  /** Grupos a los que pertenece un usuario, para resolver responsables tipo GRUPO. */
  async gruposDeUsuario(usuarioId: string): Promise<string[]> {
    const [filas] = await this.pool.query<RowDataPacket[]>(
      'select bin_to_uuid(grupo_id) as id from grupo_miembro where usuario_id = uuid_to_bin(?)',
      [usuarioId],
    );
    return filas.map((fila) => fila.id as string);
  }

  private async insertarMiembros(cx: PoolConnection, grupoId: string, usuarios: string[]): Promise<void> {
    for (const usuario of usuarios) {
      await cx.query(
        `insert into grupo_miembro (grupo_id, usuario_id, agregado_en)
         values (uuid_to_bin(?), uuid_to_bin(?), utc_timestamp(6))`,
        [grupoId, usuario],
      );
    }
  }
}
