import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { SignJWT } from 'jose';
import { crearApp } from '../src/app.js';
import { ErrorApi } from '../src/errores.js';
import { fechaLocal } from '../src/radicados/codigo.js';
import { crearRepositorioMemoria } from '../src/radicados/repositorio-memoria.js';

const SECRETO = 'secreto-de-pruebas-con-mas-de-32-caracteres';
const EMISOR = 'neptuno-ms-auth-catalogs';
const TIPO = '11111111-1111-4111-8111-111111111111';
const AREA = '44444444-4444-4444-8444-444444444444';
const USUARIO = '55555555-5555-4555-8555-555555555555';
const FLUJO = '66666666-6666-4666-8666-666666666666';
const OTRO_FLUJO = '77777777-7777-4777-8777-777777777777';

const catalogos = {
  async tipoDocumental() { return { nombre: 'Factura', estado: 'ACTIVO', origenes: ['INTERNO'] }; },
  async area() { return { estado: 'ACTIVO' }; },
  async entidad() { return null; },
};

async function token() {
  return new SignJWT({ typ: 'ACCESO', correo: 'ana@neptuno.gov.co', areaId: AREA, roles: ['Radicador'], permisos: ['radicados:crear'] })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(USUARIO)
    .setIssuer(EMISOR)
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(SECRETO));
}

const cuerpo = (extra = {}) => ({
  origen: 'INTERNO',
  tipoDocumentalId: TIPO,
  asunto: 'Solicitud de compra',
  remitente: 'Ana Gómez',
  destinatario: 'Compras',
  fechaDocumento: fechaLocal(new Date()),
  ...extra,
});

describe('radicación con flujo de trabajo', () => {
  let servidor, base, iniciados, falloInicio;

  const workflow = {
    async flujosDisponibles(tipoId) { return tipoId === TIPO ? [{ id: FLUJO, nombre: 'Compras' }] : []; },
    async iniciarTramite(datos) {
      if (falloInicio) throw new ErrorApi(503, 'SERVICIO_NO_DISPONIBLE', 'No se pudo consultar servicio-workflow.');
      iniciados.push(datos);
      return { id: 'tramite-1', radicadoId: datos.radicadoId, estadoActual: 'Recepción' };
    },
  };

  before(async () => {
    const app = crearApp({ config: { jwt: { secreto: SECRETO, emisor: EMISOR } }, repo: crearRepositorioMemoria(), catalogos, workflow });
    await new Promise((ok) => { servidor = app.listen(0, ok); });
    base = `http://127.0.0.1:${servidor.address().port}/api/documentos/radicados`;
  });
  after(() => servidor.close());

  const radicar = async (extra) => {
    iniciados = [];
    const respuesta = await fetch(base, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo(extra)),
    });
    return { estado: respuesta.status, cuerpo: await respuesta.json() };
  };

  it('sin flujo radica igual y no toca el workflow', async () => {
    falloInicio = false;
    const { estado, cuerpo: radicado } = await radicar();
    assert.equal(estado, 201);
    assert.equal(radicado.tramite, undefined);
    assert.equal(iniciados.length, 0);
  });

  it('con un flujo que atiende el tipo inicia el trámite del radicado', async () => {
    falloInicio = false;
    const { estado, cuerpo: radicado } = await radicar({ flujoId: FLUJO });
    assert.equal(estado, 201);
    assert.equal(radicado.tramite.estadoActual, 'Recepción');
    assert.deepEqual(iniciados[0], {
      radicadoId: radicado.id, radicadoCodigo: radicado.codigo, flujoId: FLUJO, tipoDocumentalId: TIPO,
    });
  });

  it('rechaza un flujo que no atiende el tipo documental y no crea el radicado', async () => {
    falloInicio = false;
    const { estado, cuerpo: error } = await radicar({ flujoId: OTRO_FLUJO });
    assert.equal(estado, 400);
    assert.match(error.mensaje, /flujo elegido/);
    assert.equal(iniciados.length, 0);
  });

  it('si el trámite no arranca, el radicado queda creado y se avisa', async () => {
    falloInicio = true;
    const { estado, cuerpo: radicado } = await radicar({ flujoId: FLUJO });
    assert.equal(estado, 201);
    assert.equal(radicado.tramite, null);
    assert.match(radicado.advertencia, /no pudo iniciarse/);
  });
});
