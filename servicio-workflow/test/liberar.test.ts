import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorApi } from '../src/errores';
import { ServicioTramites } from '../src/tramites/servicio';

// HU-070: una tarea tomada vuelve a la bolsa del paso solo si quien la libera es quien la tomó;
// una pendiente, una ajena o una inexistente no se liberan.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TAREA = uuid(2);
const TRAMITE = uuid(3);
const USUARIO = uuid(5);

const actor = {
  id: USUARIO,
  correo: 'ana@neptuno.gov.co',
  roles: ['Aprobador'],
  rolesIds: [],
  permisos: new Set(['flujo:aprobar']),
};

function escenario(tarea: Record<string, unknown> | null) {
  const llamadas = { liberar: 0 };
  const repo = {
    async tarea() {
      return tarea;
    },
    async liberar() {
      llamadas.liberar++;
    },
    async detalle() {
      return { id: TRAMITE, tareaAbierta: { responsables: [], acciones: [], asignadaA: null } };
    },
  };
  return { servicio: new ServicioTramites(repo as any, {} as any, {} as any), llamadas };
}

const tomada = (asignadaA: string | null, estado = 'TOMADA') => ({ id: TAREA, tramiteId: TRAMITE, estado, asignadaA });

async function estado(promesa: Promise<unknown>): Promise<number> {
  try {
    await promesa;
    return 200;
  } catch (error) {
    assert.ok(error instanceof ErrorApi, String(error));
    return error.getStatus();
  }
}

test('liberar devuelve la tarea a la bolsa', async () => {
  const { servicio, llamadas } = escenario(tomada(USUARIO));
  const resultado = await servicio.liberar(TAREA, actor as any);
  assert.equal(llamadas.liberar, 1);
  assert.equal(resultado.id, TRAMITE);
});

test('no se libera una tarea que tomó otra persona', async () => {
  const { servicio, llamadas } = escenario(tomada(uuid(99)));
  assert.equal(await estado(servicio.liberar(TAREA, actor as any)), 409);
  assert.equal(llamadas.liberar, 0);
});

test('una tarea que no existe responde 404', async () => {
  const { servicio, llamadas } = escenario(null);
  assert.equal(await estado(servicio.liberar(TAREA, actor as any)), 404);
  assert.equal(await estado(servicio.liberar('no-es-uuid', actor as any)), 404);
  assert.equal(llamadas.liberar, 0);
});
