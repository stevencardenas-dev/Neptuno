import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Reflector } from '@nestjs/core';
import { AutenticacionGuard, PERMISO } from '../src/autenticacion';
import type { Actor } from '../src/autenticacion';
import { ErrorApi } from '../src/errores';
import { TramitesControlador } from '../src/tramites/controlador';
import type { ClienteDocumentos, ResumenRadicado } from '../src/tramites/documentos';
import { esquemaEjecutar, esquemaIniciar } from '../src/tramites/modelo';
import type { RepositorioTramites } from '../src/tramites/repositorio';
import { ServicioTramites } from '../src/tramites/servicio';

// HU-062 y HU-066…HU-068: el cuerpo de las dos rutas que mueven un trámite. Lo que se
// fija aquí es lo que el servicio no debe dejar pasar: identificadores que no son UUID,
// acciones fuera del catálogo y devolver o cancelar sin motivo.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('iniciar un trámite exige radicado y flujo con forma de UUID', () => {
  assert.deepEqual(esquemaIniciar.parse({ radicadoId: uuid(1), flujoId: uuid(2) }), {
    radicadoId: uuid(1),
    flujoId: uuid(2),
  });
});

test('iniciar acepta el cuerpo de servicio-documentos y descarta el código y el tipo', () => {
  const cuerpo = { radicadoId: uuid(1), radicadoCodigo: 'RAD-2026-000001', flujoId: uuid(2), tipoDocumentalId: uuid(3) };
  assert.deepEqual(esquemaIniciar.parse(cuerpo), { radicadoId: uuid(1), flujoId: uuid(2) });
});

test('iniciar rechaza un cuerpo incompleto o con identificadores inventados', () => {
  assert.throws(() => esquemaIniciar.parse({}), /radicado es obligatorio/);
  assert.throws(() => esquemaIniciar.parse({ radicadoId: uuid(1) }), /flujo es obligatorio/);
  assert.throws(
    () => esquemaIniciar.parse({ radicadoId: 'no-es-un-uuid', flujoId: uuid(2) }),
    /radicado no es válido/,
  );
});

test('aprobar o enviar no exigen observación', () => {
  assert.deepEqual(esquemaEjecutar.parse({ accion: 'APROBAR' }), { accion: 'APROBAR' });
  assert.deepEqual(esquemaEjecutar.parse({ accion: 'ENVIAR', observacion: '  ' }), {
    accion: 'ENVIAR',
    observacion: '',
  });
});

test('devolver y cancelar exigen una observación de al menos 3 caracteres', () => {
  assert.throws(() => esquemaEjecutar.parse({ accion: 'DEVOLVER' }), /al menos 3 caracteres/);
  assert.throws(() => esquemaEjecutar.parse({ accion: 'CANCELAR', observacion: '  no ' }), /al menos 3 caracteres/);
  assert.deepEqual(esquemaEjecutar.parse({ accion: 'DEVOLVER', observacion: 'Falta el anexo' }), {
    accion: 'DEVOLVER',
    observacion: 'Falta el anexo',
  });
});

test('la acción tiene que estar en el catálogo', () => {
  assert.throws(() => esquemaEjecutar.parse({ accion: 'BORRAR' }), /Invalid enum value/);
  assert.throws(() => esquemaEjecutar.parse({}), /acción es obligatoria/);
});

test('el cuerpo no admite campos que no estén definidos', () => {
  assert.throws(() => esquemaEjecutar.parse({ accion: 'APROBAR', radicadoId: uuid(1) }));
});

test('la observación no puede superar los 2000 caracteres', () => {
  assert.throws(
    () => esquemaEjecutar.parse({ accion: 'APROBAR', observacion: 'x'.repeat(2001) }),
    /no puede superar 2000 caracteres/,
  );
});

// HU-062: reglas al abrir un trámite. El repositorio y servicio-documentos se sustituyen por
// dobles: lo que se fija es qué se comprueba, con qué datos se crea y qué se avisa.

const RADICADO = uuid(10);
const FLUJO = uuid(20);
const VERSION = uuid(21);
const PASO_INICIAL = uuid(22);
const TIPO = uuid(30);
const OTRO_TIPO = uuid(31);

const actor: Actor = {
  id: uuid(40),
  correo: 'ana@neptuno.gov.co',
  roles: ['Radicador'],
  rolesIds: [],
  permisos: new Set(['radicados:crear']),
};

function escenario(opciones: { radicado?: Partial<ResumenRadicado>; atiende?: string[]; falloAviso?: boolean; activo?: boolean } = {}) {
  const creados: any[] = [];
  const avisos: string[] = [];
  const radicado: ResumenRadicado = {
    id: RADICADO,
    codigo: 'RAD-2026-000007',
    asunto: 'Solicitud de compra',
    estado: 'RADICADO',
    tipoDocumentalId: TIPO,
    origen: 'INTERNO',
    areaId: uuid(50),
    radicadoPor: actor.id,
    ...opciones.radicado,
  };
  const atiende = opciones.atiende ?? [TIPO];
  const repo = {
    async flujoActivo(id: string) {
      return opciones.activo === false || id !== FLUJO ? null : { id: FLUJO, nombre: 'Compras', versionId: VERSION, sla: 60 };
    },
    async estadoInicial() {
      return { id: PASO_INICIAL, nombre: 'Recepción', tipo: 'INICIAL', slaMinutos: null };
    },
    async atiendeTipo(flujoId: string, tipoId: string) {
      return flujoId === FLUJO && atiende.includes(tipoId);
    },
    async crear(datos: any) {
      creados.push(datos);
      return uuid(60);
    },
    async detalle(id: string) {
      return { id, radicadoId: RADICADO, estadoActual: 'Recepción', tareaAbierta: null, movimientos: [] };
    },
  } as unknown as RepositorioTramites;
  const documentos: ClienteDocumentos = {
    async radicado() {
      return radicado;
    },
    async marcarEstado(_id, estado) {
      if (opciones.falloAviso) throw new Error('documentos no responde');
      avisos.push(estado);
    },
  };
  const servicio = new ServicioTramites(repo, documentos, {} as any);
  return { servicio, creados, avisos };
}

async function estadoDe(promesa: Promise<unknown>): Promise<number> {
  try {
    await promesa;
    return 200;
  } catch (error) {
    assert.ok(error instanceof ErrorApi, String(error));
    return error.getStatus();
  }
}

test('al iniciar se usan los datos del radicado leídos de documentos y se avisa EN_TRAMITE', async () => {
  const { servicio, creados, avisos } = escenario();
  const tramite = await servicio.iniciar(
    { radicadoId: RADICADO, radicadoCodigo: 'OTRO-CODIGO', flujoId: FLUJO, tipoDocumentalId: OTRO_TIPO },
    actor,
  );
  assert.equal(tramite?.id, uuid(60));
  assert.equal(creados.length, 1);
  assert.equal(creados[0].radicadoCodigo, 'RAD-2026-000007');
  assert.equal(creados[0].radicadoAsunto, 'Solicitud de compra');
  assert.equal(creados[0].versionId, VERSION);
  assert.equal(creados[0].estadoInicial.id, PASO_INICIAL);
  assert.deepEqual(avisos, ['EN_TRAMITE']);
});

test('el flujo tiene que atender el tipo documental del radicado, no el del cuerpo', async () => {
  const { servicio, creados } = escenario({ atiende: [OTRO_TIPO] });
  const estado = await estadoDe(
    servicio.iniciar({ radicadoId: RADICADO, flujoId: FLUJO, tipoDocumentalId: OTRO_TIPO }, actor),
  );
  assert.equal(estado, 422);
  assert.equal(creados.length, 0);
});

test('un flujo inactivo o sin versión publicada no abre trámites', async () => {
  const { servicio, creados } = escenario({ activo: false });
  assert.equal(await estadoDe(servicio.iniciar({ radicadoId: RADICADO, flujoId: FLUJO }, actor)), 422);
  assert.equal(creados.length, 0);
});

test('un radicado anulado, en trámite o finalizado no se envía a un flujo', async () => {
  for (const estado of ['ANULADO', 'EN_TRAMITE', 'FINALIZADO']) {
    const { servicio, creados } = escenario({ radicado: { estado } });
    assert.equal(await estadoDe(servicio.iniciar({ radicadoId: RADICADO, flujoId: FLUJO }, actor)), 409, estado);
    assert.equal(creados.length, 0, estado);
  }
});

test('si el aviso a documentos falla el trámite queda abierto igual', async () => {
  const { servicio, creados } = escenario({ falloAviso: true });
  const avisar = console.warn;
  console.warn = () => {};
  try {
    const tramite = await servicio.iniciar({ radicadoId: RADICADO, flujoId: FLUJO }, actor);
    assert.equal(tramite?.id, uuid(60));
    assert.equal(creados.length, 1);
  } finally {
    console.warn = avisar;
  }
});

// Abrir un trámite admite cualquiera de los dos permisos: `radicados:crear` (lo abre
// servicio-documentos con el token de quien radica) o `flujo:iniciar`.


test('POST /tramites declara los dos permisos alternativos', () => {
  const reflector = new Reflector();
  assert.deepEqual(reflector.get(PERMISO, TramitesControlador.prototype.iniciar), ['radicados:crear', 'flujo:iniciar']);
  assert.deepEqual(reflector.get(PERMISO, TramitesControlador.prototype.bandeja), ['flujo:aprobar']);
});

test('la guardia deja pasar con uno de los permisos y rechaza sin ninguno', async () => {
  const jose = await (new Function('m', 'return import(m)') as (m: string) => Promise<any>)('jose');
  const secreto = 'secreto-de-pruebas-con-mas-de-32-caracteres';
  const guardia = new AutenticacionGuard({ jwt: { secreto, emisor: 'neptuno' } } as any, new Reflector());
  const token = (permisos: string[]) =>
    new jose.SignJWT({ typ: 'ACCESO', correo: 'ana@neptuno.gov.co', permisos })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(actor.id)
      .setIssuer('neptuno')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(secreto));
  const contexto = async (permisos: string[]) => {
    const peticion = { headers: { authorization: `Bearer ${await token(permisos)}` } };
    return {
      getHandler: () => TramitesControlador.prototype.iniciar,
      getClass: () => TramitesControlador,
      switchToHttp: () => ({ getRequest: () => peticion }),
    } as any;
  };
  assert.equal(await guardia.canActivate(await contexto(['radicados:crear'])), true);
  assert.equal(await guardia.canActivate(await contexto(['flujo:iniciar'])), true);
  await assert.rejects(guardia.canActivate(await contexto(['radicados:consultar'])), (error: any) => {
    assert.equal(error.getStatus(), 403);
    assert.match(error.getResponse().mensaje, /radicados:crear o flujo:iniciar/);
    return true;
  });
});
