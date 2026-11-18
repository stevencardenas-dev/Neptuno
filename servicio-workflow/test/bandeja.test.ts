import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorApi } from '../src/errores';
import { esquemaFiltrosBandeja, esResponsable, semaforoDe } from '../src/tramites/modelo';
import { ServicioTramites } from '../src/tramites/servicio';

// HU-064, HU-069, HU-070, HU-074: la bandeja se filtra y ordena, el semáforo se calcula
// contra el vencimiento, un grupo atiende el paso por sus miembros y una tarea tomada se
// puede liberar.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PASO = uuid(1);
const TAREA = uuid(2);
const TRAMITE = uuid(3);
const GRUPO = uuid(4);
const USUARIO = uuid(5);

const actor = {
  id: USUARIO,
  correo: 'ana@neptuno.gov.co',
  nombre: 'Ana Pérez',
  roles: ['Aprobador'],
  rolesIds: [],
  permisos: new Set(['flujo:aprobar', 'firma:aplicar']),
};

const RADICADO = {
  id: uuid(8), codigo: '20261028010001', asunto: 'Compra', estado: 'EN_TRAMITE',
  tipoDocumentalId: uuid(9), origen: 'INTERNO', areaId: uuid(10), radicadoPor: USUARIO,
};

function tarea(extra: Record<string, unknown> = {}) {
  return {
    id: TAREA, tramiteId: TRAMITE, estado: 'PENDIENTE', asignadaA: null,
    pasoId: PASO, pasoNombre: 'Revisión', pasoTipo: 'INTERMEDIO', estadoFlujoId: PASO,
    radicadoId: RADICADO.id, radicadoCodigo: RADICADO.codigo, radicadoAsunto: RADICADO.asunto,
    flujoId: uuid(20), flujoNombre: 'Compras', versionId: uuid(21), tramiteEstado: 'EN_CURSO',
    requiereFirma: true, ...extra,
  };
}

function detalle() {
  return {
    id: TRAMITE, radicadoId: RADICADO.id, radicadoCodigo: RADICADO.codigo, radicadoAsunto: RADICADO.asunto,
    flujoId: uuid(20), flujoNombre: 'Compras', versionId: uuid(21),
    tipoDocumentalId: RADICADO.tipoDocumentalId, origen: 'INTERNO', semaforo: 'SIN_PLAZO',
    documento: null, anexos: [], firmas: [],
    estadoActualId: PASO, estadoActual: 'Revisión', estado: 'EN_CURSO',
    iniciadoEn: new Date(), venceEn: null, finalizadoEn: null,
    pasoActual: { id: PASO, nombre: 'Revisión', tipo: 'INTERMEDIO' },
    tareaAbierta: {
      id: TAREA, tramiteId: TRAMITE, radicadoId: RADICADO.id, radicadoCodigo: RADICADO.codigo,
      radicadoAsunto: RADICADO.asunto, flujoId: uuid(20), flujoNombre: 'Compras',
      tipoDocumentalId: RADICADO.tipoDocumentalId, origen: 'INTERNO',
      paso: { id: PASO, nombre: 'Revisión', tipo: 'INTERMEDIO' }, estado: 'PENDIENTE',
      asignadaA: null, tomadaEn: null, creadaEn: new Date(), venceEn: null, vencida: false,
      semaforo: 'SIN_PLAZO', requiereFirma: true, firmada: false, esMia: false, supervision: false,
      responsables: [{ tipoSujeto: 'GRUPO', sujetoId: GRUPO }],
      acciones: [{ transicionId: uuid(30), accion: 'APROBAR', etiqueta: 'Aprobar', destinoId: uuid(31), destinoNombre: 'Fin' }],
    },
    movimientos: [],
  };
}

function escenario({ firma = null, requires = true, tareaDatos = {} as Record<string, unknown> }: { firma?: any; requires?: boolean; tareaDatos?: Record<string, unknown> } = {}) {
  const llamadas = { ejecutar: 0, liberar: 0, firmar: 0, bandeja: null as any };
  const repo = {
    async bandeja(_actor: any, _todas: boolean, filtros: any) {
      llamadas.bandeja = filtros;
      return [];
    },
    async tarea() { return tarea({ requiereFirma: requires, ...tareaDatos }); },
    async responsablesDe() { return [{ tipoSujeto: 'GRUPO' as const, sujetoId: GRUPO }]; },
    async gruposDeUsuario() { return [GRUPO]; },
    async firmaDeTarea() { return firma; },
    async firmar(_id: string, datos: any) { llamadas.firmar++; return { id: uuid(40), tareaId: TAREA, ipOrigen: datos.ip, ...datos }; },
    async transicionDesde() { return { id: uuid(30), destinoId: uuid(31) }; },
    async tomar() {},
    async ejecutar() { llamadas.ejecutar++; return { tramiteId: TRAMITE, estado: 'EN_CURSO', accion: 'APROBAR' }; },
    async liberar() { llamadas.liberar++; },
    async detalle() { return detalle(); },
  };
  const documentos = {
    async radicado() { return RADICADO; },
    async anexos() { return []; },
    async marcarEstado() {},
  };
  return { servicio: new ServicioTramites(repo as any, documentos as any, {} as any), llamadas };
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

test('el semáforo se calcula contra el vencimiento', () => {
  const ahora = new Date('2026-10-28T12:00:00Z');
  assert.equal(semaforoDe(null, ahora), 'SIN_PLAZO');
  assert.equal(semaforoDe('2026-10-27T12:00:00Z', ahora), 'ROJO');
  assert.equal(semaforoDe('2026-10-28T18:00:00Z', ahora), 'AMBAR');
  assert.equal(semaforoDe('2026-10-30T12:00:00Z', ahora), 'VERDE');
});

test('los filtros de la bandeja descartan los vacíos y validan el orden', () => {
  assert.deepEqual(esquemaFiltrosBandeja.parse({ desde: '', origen: '', orden: '' }), {
    desde: undefined, origen: undefined, vencidas: false, orden: 'VENCIMIENTO',
  });
  assert.equal(esquemaFiltrosBandeja.parse({ vencidas: 'true' }).vencidas, true);
  assert.equal(esquemaFiltrosBandeja.safeParse({ orden: 'CARO' }).success, false);
  assert.equal(esquemaFiltrosBandeja.safeParse({ tipoDocumentalId: 'no-uuid' }).success, false);
});

test('un grupo atiende el paso si el actor es miembro', () => {
  const responsables = [{ tipoSujeto: 'GRUPO' as const, sujetoId: GRUPO }];
  assert.equal(esResponsable(actor, responsables, [GRUPO]), true);
  assert.equal(esResponsable(actor, responsables, []), false);
  assert.equal(esResponsable(actor, [], []), true);
});

test('la bandeja pasa los filtros validados al repositorio', async () => {
  const { servicio, llamadas } = escenario();
  await servicio.bandeja(actor as any, { origen: 'INTERNO', orden: 'RECIENTES' });
  assert.equal(llamadas.bandeja.orden, 'RECIENTES');
  assert.equal(llamadas.bandeja.origen, 'INTERNO');
});

test('un paso con firma obligatoria no avanza sin firmar', async () => {
  const { servicio, llamadas } = escenario({ firma: null });
  assert.equal(await estado(servicio.ejecutar(TAREA, { accion: 'APROBAR' }, actor as any)), 422);
  assert.equal(llamadas.ejecutar, 0);
});

test('la firma sella el trámite y con ella puesta la acción avanza', async () => {
  const yaFirmada = escenario({ firma: { id: uuid(40), tareaId: TAREA, firmanteId: USUARIO } });
  await assert.rejects(
    yaFirmada.servicio.firmar(TAREA, {}, actor as any, '127.0.0.1'),
    (error: any) => /Ya firmaste/.test(error.getResponse().mensaje),
  );
  assert.equal(yaFirmada.llamadas.firmar, 0, 'ya estaba firmada: se rechaza');

  const segundo = escenario();
  const firma = await segundo.servicio.firmar(TAREA, {}, actor as any, '10.0.0.1');
  assert.equal(segundo.llamadas.firmar, 1);
  assert.equal(firma.firmanteNombre, 'Ana Pérez');
  assert.match(firma.hashDocumento, /^[a-f0-9]{64}$/);
  assert.equal(firma.ipOrigen, '10.0.0.1');

  const conFirma = escenario({ firma: { id: uuid(41), tareaId: TAREA, firmanteId: USUARIO } });
  assert.equal(await estado(conFirma.servicio.ejecutar(TAREA, { accion: 'APROBAR' }, actor as any)), 200);
  assert.equal(conFirma.llamadas.ejecutar, 1);
});

test('firmar un paso que no lo exige se rechaza', async () => {
  const { servicio } = escenario({ requires: false });
  assert.equal(await estado(servicio.firmar(TAREA, {}, actor as any, null)), 422);
});

test('liberar devuelve la tarea a la bolsa', async () => {
  const { servicio, llamadas } = escenario({ tareaDatos: { estado: 'TOMADA', asignadaA: USUARIO } });
  const resultado = await servicio.liberar(TAREA, actor as any);
  assert.equal(llamadas.liberar, 1);
  assert.equal(resultado.id, TRAMITE);
});

test('no se libera una tarea que tomó otra persona', async () => {
  const { servicio, llamadas } = escenario({ tareaDatos: { estado: 'TOMADA', asignadaA: uuid(99) } });
  assert.equal(await estado(servicio.liberar(TAREA, actor as any)), 409);
  assert.equal(llamadas.liberar, 0);
});
