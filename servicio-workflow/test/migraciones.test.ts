import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import type { Pool } from 'mysql2/promise';
import { migrar } from '../src/db';

// `npm test` corre desde servicio-workflow/, donde viven las migraciones reales.
const MIGRACIONES = path.resolve('db', 'migrations');

// Una migración que se cortó a medias deja DDL ya aplicado: el reintento debe terminarla
// en vez de quedarse en un bucle de "Duplicate column name".

function poolFalso(repetidas: RegExp, errno: number) {
  const ejecutadas: string[] = [];
  const cx = {
    async query(sql: string) {
      ejecutadas.push(sql);
      if (/from schema_migraciones/.test(sql)) return [[{ version: 1 }, { version: 2 }]];
      if (repetidas.test(sql)) throw Object.assign(new Error('ya existe'), { errno, sqlMessage: 'ya existe' });
      return [[]];
    },
    release() {},
  };
  return { pool: { getConnection: async () => cx } as unknown as Pool, ejecutadas };
}

test('la V3 reanuda aunque su primer ALTER ya estuviera aplicado', async () => {
  const { pool, ejecutadas } = poolFalso(/add column radicado_asunto/, 1060);
  await migrar(pool, { info() {}, warn() {} } as any, MIGRACIONES);
  assert.ok(ejecutadas.some((s) => /create table tarea/.test(s)), 'sigue con las demás sentencias');
  assert.ok(ejecutadas.some((s) => /insert into schema_migraciones/.test(s)), 'queda registrada');
});

test('un error que no es de "ya existe" sigue deteniendo la migración', async () => {
  const { pool } = poolFalso(/create table tarea/, 1064);
  await assert.rejects(() => migrar(pool, { info() {}, warn() {} } as any, MIGRACIONES), (e: any) => e.errno === 1064);
});
