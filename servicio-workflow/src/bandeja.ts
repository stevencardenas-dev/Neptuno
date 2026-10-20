import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection } from 'mysql2/promise';

/**
 * Piezas que comparten los dos repositorios del servicio: la bandeja de salida y el
 * manejo de transacciones. Se escribió aquí al separar el diseñador de la identidad del
 * flujo, para que la forma del evento sea una sola en todo el servicio.
 */

/** Datos del actor que se guardan junto al evento para la bitácora. */
export interface Autor {
  id: string | null;
  correo: string | null;
}

/** Un evento a punto de entrar en la bandeja de salida. */
export interface EventoNuevo {
  tipo: string;
  entidad: string;
  entidadId: string | null;
  actor: Autor;
  detalle: unknown;
}

/**
 * Deja el hecho en la bandeja de salida dentro de la misma transacción que el cambio:
 * o quedan los dos o no queda ninguno. Quien publica es el módulo de eventos.
 */
export async function registrarEvento(cx: PoolConnection, evento: EventoNuevo): Promise<void> {
  await cx.query(
    `insert into evento_saliente
       (id, tipo, entidad, entidad_id, actor_id, actor_correo, datos, ocurrido_en, estado_publicacion)
     values (uuid_to_bin(?), ?, ?, ?, uuid_to_bin(?), ?, cast(? as json), utc_timestamp(6), 'PENDIENTE')`,
    [
      randomUUID(),
      evento.tipo,
      evento.entidad,
      evento.entidadId,
      evento.actor.id,
      evento.actor.correo,
      JSON.stringify(evento.detalle ?? {}),
    ],
  );
}

/** Ejecuta `fn` en una transacción del pool y la cierra según el resultado. */
export async function enTransaccion<T>(pool: Pool, fn: (cx: PoolConnection) => Promise<T>): Promise<T> {
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const resultado = await fn(cx);
    await cx.commit();
    return resultado;
  } catch (error) {
    await cx.rollback();
    throw error;
  } finally {
    cx.release();
  }
}
