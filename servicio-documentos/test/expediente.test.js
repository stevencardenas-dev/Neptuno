import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alcanza, esquemaAccesos, esquemaCarpeta, esquemaDocumento, mayorNivel } from '../src/expediente/modelo.js';
import { crearServicioExpediente } from '../src/expediente/servicio.js';

// HU-030…HU-034: el árbol se arma con los accesos heredados de la carpeta padre, el
// área dueña administra su rama y un documento No radicable exige poder cargar.

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AREA = uuid(1);
const OTRA_AREA = uuid(2);
const ROL = uuid(3);

function actor(extra = {}) {
  return {
    id: uuid(9),
    correo: 'ana@neptuno.gov.co',
    areaId: AREA,
    rolesIds: [ROL],
    permisos: new Set(['expediente:ver']),
    token: 'token',
    ...extra,
  };
}

function repoFalso(carpetas) {
  return {
    listarCarpetas: async () => carpetas,
    listarAccesos: async () => [],
    listarDocumentos: async () => [],
    radicadosEnCarpetas: async () => [],
  };
}

test('el área dueña ve y administra toda su rama', async () => {
  const servicio = crearServicioExpediente({ repo: repoFalso([
    { id: uuid(10), areaId: AREA, padreId: null, nombre: 'Administrativa', ruta: '/Administrativa' },
    { id: uuid(11), areaId: AREA, padreId: uuid(10), nombre: 'Contratos', ruta: '/Administrativa/Contratos' },
  ]), catalogos: {} });
  const arbol = await servicio.arbol(actor());
  assert.equal(arbol.length, 1);
  assert.equal(arbol[0].nivel, 'ADMINISTRAR');
  assert.equal(arbol[0].carpetas[0].nombre, 'Contratos');
});

test('un acceso heredado de la carpeta padre alcanza a la subcarpeta', async () => {
  const repo = repoFalso([
    { id: uuid(10), areaId: OTRA_AREA, padreId: null, nombre: 'Jurídica', ruta: '/Jurídica' },
    { id: uuid(11), areaId: OTRA_AREA, padreId: uuid(10), nombre: 'Procesos', ruta: '/Jurídica/Procesos' },
  ]);
  repo.listarAccesos = async () => [{ carpetaId: uuid(10), tipoSujeto: 'ROL', sujetoId: ROL, nivel: 'CARGAR' }];
  const servicio = crearServicioExpediente({ repo, catalogos: {} });
  const arbol = await servicio.arbol(actor());
  assert.equal(arbol.length, 1);
  assert.equal(arbol[0].nivel, 'CARGAR');
  assert.equal(arbol[0].carpetas[0].nivel, 'CARGAR');
});

test('sin área ni acceso la carpeta no aparece en el árbol', async () => {
  const repo = repoFalso([
    { id: uuid(10), areaId: OTRA_AREA, padreId: null, nombre: 'Tesorería', ruta: '/Tesorería' },
  ]);
  const servicio = crearServicioExpediente({ repo, catalogos: {} });
  assert.deepEqual(await servicio.arbol(actor()), []);
});

test('solo se ven las ramas permitidas cuando la raíz está oculta', async () => {
  const repo = repoFalso([
    { id: uuid(10), areaId: OTRA_AREA, padreId: null, nombre: 'Tesorería', ruta: '/Tesorería' },
    { id: uuid(11), areaId: OTRA_AREA, padreId: uuid(10), nombre: 'Pagos', ruta: '/Tesorería/Pagos' },
  ]);
  repo.listarAccesos = async () => [{ carpetaId: uuid(11), tipoSujeto: 'AREA', sujetoId: AREA, nivel: 'VER' }];
  const servicio = crearServicioExpediente({ repo, catalogos: {} });
  const arbol = await servicio.arbol(actor());
  assert.equal(arbol.length, 1);
  assert.equal(arbol[0].nombre, 'Pagos');
  assert.equal(arbol[0].nivel, 'VER');
});

test('los permisos se heredan al subárbol visible y se queda el nivel más alto', async () => {
  const repo = repoFalso([
    { id: uuid(10), areaId: AREA, padreId: null, nombre: 'Administrativa', ruta: '/Administrativa' },
  ]);
  repo.listarAccesos = async () => [
    { carpetaId: uuid(10), tipoSujeto: 'ROL', sujetoId: ROL, nivel: 'VER' },
    { carpetaId: uuid(10), tipoSujeto: 'AREA', sujetoId: AREA, nivel: 'ADMINISTRAR' },
  ];
  const servicio = crearServicioExpediente({ repo, catalogos: {} });
  assert.equal((await servicio.arbol(actor()))[0].nivel, 'ADMINISTRAR');

  assert.equal(mayorNivel(['VER', 'CARGAR', null]), 'CARGAR');
  assert.equal(mayorNivel([]), null);
});

test('un documento No radicable exige el nivel CARGAR', async () => {
  const carpeta = { id: uuid(10), areaId: OTRA_AREA, padreId: null, nombre: 'Otra', ruta: '/Otra', estado: 'ACTIVO' };
  const repo = {
    carpeta: async () => carpeta,
    nivelAcceso: async () => 'VER',
    crearDocumento: async () => assert.fail('no debería crear'),
  };
  const servicio = crearServicioExpediente({ repo, catalogos: {} });
  await assert.rejects(
    servicio.crearDocumento(actor(), uuid(10), { titulo: 'Acta de visita' }),
    (error) => error.estado === 403,
  );
});

test('los niveles se comparan de forma explícita', () => {
  assert.equal(alcanza('ADMINISTRAR', 'CARGAR'), true);
  assert.equal(alcanza('CARGAR', 'ADMINISTRAR'), false);
  assert.equal(alcanza(null, 'VER'), false);
});

test('las entradas del expediente se validan antes de tocar la base', () => {
  assert.equal(esquemaCarpeta.safeParse({ nombre: 'Contratos' }).success, true);
  assert.equal(esquemaCarpeta.safeParse({ nombre: 'X' }).success, false);
  assert.equal(esquemaDocumento.safeParse({ titulo: 'Ac' }).success, false);
  assert.equal(esquemaDocumento.safeParse({ titulo: 'Acta de visita' }).success, true);
  assert.equal(esquemaAccesos.safeParse({ accesos: [{ tipoSujeto: 'ROL', sujetoId: ROL, nivel: 'VER' }] }).success, true);
  assert.equal(esquemaAccesos.safeParse({ accesos: [{ tipoSujeto: 'OTRO', sujetoId: ROL, nivel: 'VER' }] }).success, false);
});
