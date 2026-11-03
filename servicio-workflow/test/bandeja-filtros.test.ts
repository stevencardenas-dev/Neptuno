import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorApi } from '../src/errores';
import { esquemaFiltrosBandeja } from '../src/tramites/modelo';
import { ServicioTramites } from '../src/tramites/servicio';

// HU-064: la bandeja se filtra por fecha, tipo documental, origen y vencimiento, y se ordena.
// Los vacíos del formulario no filtran y un rango de fechas al revés se rechaza.

const actor = {
  id: '00000000-0000-4000-8000-000000000005',
  correo: 'ana@neptuno.gov.co',
  roles: [],
  rolesIds: [],
  permisos: new Set(['flujo:aprobar']),
};

function escenario() {
  const llamadas: any[] = [];
  const repo = {
    async bandeja(_actor: unknown, todas: boolean, filtros: unknown) {
      llamadas.push({ todas, filtros });
      return [];
    },
  };
  return { servicio: new ServicioTramites(repo as any, {} as any, {} as any), llamadas };
}

test('los filtros vacíos no filtran y el orden por defecto es el vencimiento', () => {
  assert.deepEqual(esquemaFiltrosBandeja.parse({ desde: '', origen: '', orden: '' }), {
    desde: undefined,
    origen: undefined,
    vencidas: false,
    orden: 'VENCIMIENTO',
  });
  assert.equal(esquemaFiltrosBandeja.parse({ vencidas: 'true' }).vencidas, true);
});

test('el orden, el origen, el tipo y las fechas se validan', () => {
  assert.equal(esquemaFiltrosBandeja.safeParse({ orden: 'CARO' }).success, false);
  assert.equal(esquemaFiltrosBandeja.safeParse({ origen: 'MARCIANO' }).success, false);
  assert.equal(esquemaFiltrosBandeja.safeParse({ tipoDocumentalId: 'no-uuid' }).success, false);
  assert.equal(esquemaFiltrosBandeja.safeParse({ desde: '28/10/2026' }).success, false);
  assert.equal(esquemaFiltrosBandeja.safeParse({ origen: 'EXTERNO', orden: 'RECIENTES', desde: '2026-10-28' }).success, true);
});

test('la bandeja pasa los filtros validados al repositorio', async () => {
  const { servicio, llamadas } = escenario();
  await servicio.bandeja(actor as any, { origen: 'INTERNO', orden: 'ANTIGUOS' });
  assert.equal(llamadas[0].filtros.origen, 'INTERNO');
  assert.equal(llamadas[0].filtros.orden, 'ANTIGUOS');
  assert.equal(llamadas[0].todas, false);
});

test('un rango de fechas al revés se rechaza sin consultar', async () => {
  const { servicio, llamadas } = escenario();
  await assert.rejects(
    servicio.bandeja(actor as any, { desde: '2026-10-30', hasta: '2026-10-01' }),
    (error: unknown) => error instanceof ErrorApi && error.getStatus() === 400,
  );
  assert.equal(llamadas.length, 0);
});
