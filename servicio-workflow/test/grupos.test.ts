import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorApi } from '../src/errores';
import { ServicioGrupos } from '../src/grupos/servicio';
import { esResponsable } from '../src/tramites/modelo';

// HU-069: un grupo de trabajo atiende el paso por sus miembros; solo se crea con usuarios
// activos del catálogo y con un nombre que no se repita.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const GRUPO = uuid(4);
const USUARIO = uuid(5);
const actor = { id: uuid(1), correo: 'ana@neptuno.gov.co', roles: [], rolesIds: [], permisos: new Set(['flujos:administrar']) };

function escenario({ existe = false, activos = [USUARIO] as string[] } = {}) {
  const creados: any[] = [];
  const repo = {
    async existeNombre() {
      return existe;
    },
    async crear(datos: any) {
      creados.push(datos);
      return { id: GRUPO, ...datos };
    },
  };
  const catalogos = { async usuario(id: string) { return activos.includes(id) ? { id } : null; } };
  return { servicio: new ServicioGrupos(repo as any, catalogos as any), creados };
}

async function estado(promesa: Promise<unknown>): Promise<number> {
  try {
    await promesa;
    return 200;
  } catch (error) {
    assert.ok(error instanceof ErrorApi, String(error));
    return error.getStatus();
  }
}

test('un grupo atiende el paso si el actor es miembro', () => {
  const responsables = [{ tipoSujeto: 'GRUPO' as const, sujetoId: GRUPO }];
  const persona = { id: USUARIO, rolesIds: [] };
  assert.equal(esResponsable(persona, responsables, [GRUPO]), true);
  assert.equal(esResponsable(persona, responsables, []), false);
  assert.equal(esResponsable(persona, responsables), false);
  assert.equal(esResponsable(persona, [], []), true);
});

test('crear un grupo guarda los miembros sin repetirlos', async () => {
  const { servicio, creados } = escenario();
  await servicio.crear({ nombre: 'Compras', miembros: [USUARIO, USUARIO] }, actor as any, 'token');
  assert.deepEqual(creados[0].miembros, [USUARIO]);
});

test('no se crea un grupo con un nombre repetido', async () => {
  const { servicio, creados } = escenario({ existe: true });
  assert.equal(await estado(servicio.crear({ nombre: 'Compras', miembros: [USUARIO] }, actor as any, 't')), 409);
  assert.equal(creados.length, 0);
});

test('no se crea un grupo con un usuario que no existe o está inactivo', async () => {
  const { servicio, creados } = escenario({ activos: [] });
  assert.equal(await estado(servicio.crear({ nombre: 'Compras', miembros: [USUARIO] }, actor as any, 't')), 400);
  assert.equal(creados.length, 0);
});
