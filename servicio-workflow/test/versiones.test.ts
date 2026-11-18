import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Actor } from '../src/autenticacion';
import { esquemaPasoOperacion, esquemaSlaGlobal } from '../src/disenador/modelo';
import { ServicioDisenador } from '../src/disenador/servicio';
import { ErrorApi } from '../src/errores';
import { esquemaGrupo, esquemaMiembros } from '../src/grupos/modelo';
import { ServicioGrupos } from '../src/grupos/servicio';

// HU-069, HU-072, HU-073, HU-076: el diseñador configura tiempos y firma y los grupos
// validan a sus miembros contra el catálogo. El versionado (HU-078…HU-080) se prueba en
// disenador.test.ts.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const FLUJO = uuid(1);
const PASO = uuid(2);

const actor: Actor = {
  id: uuid(9),
  correo: 'admin@neptuno.gov.co',
  roles: ['Administrador'],
  rolesIds: [],
  permisos: new Set(['flujos:administrar']),
};

test('el SLA global acepta minutos o null para quitarlo', () => {
  assert.deepEqual(esquemaSlaGlobal.parse({ slaGlobalMinutos: 480 }), { slaGlobalMinutos: 480 });
  assert.deepEqual(esquemaSlaGlobal.parse({ slaGlobalMinutos: null }), { slaGlobalMinutos: null });
  assert.equal(esquemaSlaGlobal.safeParse({ slaGlobalMinutos: 0 }).success, false);
  assert.equal(esquemaSlaGlobal.safeParse({}).success, false);
});

test('la operación del paso admite solo tiempo, solo firma o ambos', () => {
  assert.deepEqual(esquemaPasoOperacion.parse({ slaMinutos: 60 }), { slaMinutos: 60 });
  assert.deepEqual(esquemaPasoOperacion.parse({ requiereFirma: true }), { requiereFirma: true });
  assert.equal(esquemaPasoOperacion.safeParse({}).success, false);
  assert.equal(esquemaPasoOperacion.safeParse({ slaMinutos: -1 }).success, false);
});

test('configurar SLA y firma pasa por el repositorio', async () => {
  const llamadas: any[] = [];
  const repo = {
    actualizarSlaGlobal: async (...args: any[]) => llamadas.push(['global', ...args]),
    actualizarOperacionPaso: async (...args: any[]) => llamadas.push(['paso', ...args]),
    grafo: async () => ({ flujoId: FLUJO, pasos: [], transiciones: [], version: null, editable: true }),
  };
  const servicio = new ServicioDisenador(repo as any, {} as any);
  await servicio.actualizarSlaGlobal(FLUJO, { slaGlobalMinutos: 120 }, actor);
  await servicio.actualizarOperacionPaso(FLUJO, PASO, { slaMinutos: null, requiereFirma: true }, actor);
  assert.deepEqual(llamadas[0].slice(0, 2), ['global', FLUJO]);
  assert.deepEqual(llamadas[0][2], 120);
  assert.deepEqual(llamadas[1].slice(0, 2), ['paso', FLUJO]);
  assert.equal(llamadas[1][3].requiereFirma, true);
});

test('un grupo exige nombre y una lista de miembros con forma de UUID', () => {
  assert.equal(esquemaGrupo.safeParse({ nombre: 'Equipo de compras' }).success, true);
  const conMiembro = esquemaGrupo.parse({ nombre: 'Equipo de compras', miembros: [uuid(7)] });
  assert.deepEqual(conMiembro.miembros, [uuid(7)]);
  assert.equal(esquemaGrupo.safeParse({ nombre: 'AB' }).success, false);
  assert.equal(esquemaMiembros.safeParse({ usuarios: ['no-uuid'] }).success, false);
});

test('crear un grupo valida sus miembros contra el catálogo', async () => {
  const creados: any[] = [];
  const repo = {
    existeNombre: async () => false,
    crear: async (datos: any) => { creados.push(datos); return { id: uuid(30), ...datos }; },
  };
  let consultados = 0;
  const catalogos = { usuario: async () => { consultados += 1; return { id: uuid(7) }; } };
  const servicio = new ServicioGrupos(repo as any, catalogos as any);
  const grupo = await servicio.crear({ nombre: 'Equipo de compras', miembros: [uuid(7), uuid(7)] }, actor, 'token');
  assert.equal(consultados, 1, 'los miembros repetidos se consultan una vez');
  assert.deepEqual(grupo.miembros, [uuid(7)]);
  assert.equal(creados.length, 1);

  const inactivo = new ServicioGrupos(repo as any, { usuario: async () => null } as any);
  try {
    await inactivo.crear({ nombre: 'Otro equipo', miembros: [uuid(8)] }, actor, 'token');
    assert.fail('debería rechazar un usuario inexistente');
  } catch (error) {
    assert.ok(error instanceof ErrorApi);
    assert.equal(error.getStatus(), 400);
  }
});
