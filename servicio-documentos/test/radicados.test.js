import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { SignJWT } from 'jose';
import { crearApp } from '../src/app.js';
import { crearRepositorioMemoria } from '../src/radicados/repositorio-memoria.js';
import { fechaLocal } from '../src/radicados/codigo.js';

const SECRETO = 'secreto-de-pruebas-con-mas-de-32-caracteres';
const EMISOR = 'neptuno-ms-auth-catalogs';
const TIPO_FACTURA = '11111111-1111-4111-8111-111111111111';
const TIPO_SOLO_INTERNO = '22222222-2222-4222-8222-222222222222';
const TIPO_INACTIVO = '33333333-3333-4333-8333-333333333333';
const AREA = '44444444-4444-4444-8444-444444444444';
const USUARIO = '55555555-5555-4555-8555-555555555555';

const catalogos = {
  async tipoDocumental(id) {
    return {
      [TIPO_FACTURA]: { nombre: 'Factura', estado: 'ACTIVO', origenes: ['INTERNO', 'EXTERNO', 'RECIBIDO'] },
      [TIPO_SOLO_INTERNO]: { nombre: 'Memorando', estado: 'ACTIVO', origenes: ['INTERNO'] },
      [TIPO_INACTIVO]: { nombre: 'Viejo', estado: 'INACTIVO', origenes: ['INTERNO'] },
    }[id] ?? null;
  },
  async area(id) { return id === AREA ? { estado: 'ACTIVO' } : null; },
  async entidad() { return null; },
};

const TODOS = ['radicados:consultar', 'radicados:crear', 'radicados:editar', 'radicados:clase'];

async function token(permisos = TODOS, extra = {}) {
  return new SignJWT({ typ: 'ACCESO', correo: 'ana@neptuno.gov.co', areaId: AREA, roles: ['Radicador'], permisos, ...extra })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(USUARIO)
    .setIssuer(EMISOR)
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(SECRETO));
}

const cuerpoBase = () => ({
  origen: 'INTERNO',
  tipoDocumentalId: TIPO_FACTURA,
  asunto: 'Solicitud de compra de papelería',
  remitente: 'Ana Gómez',
  destinatario: 'Compras',
  fechaDocumento: fechaLocal(new Date()),
});

describe('API de radicados', () => {
  let servidor, base, repo;

  before(async () => {
    repo = crearRepositorioMemoria();
    const app = crearApp({ config: { jwt: { secreto: SECRETO, emisor: EMISOR } }, repo, catalogos });
    await new Promise((ok) => { servidor = app.listen(0, ok); });
    base = `http://127.0.0.1:${servidor.address().port}/api/documentos/radicados`;
  });
  after(() => servidor.close());

  async function llamar(metodo, ruta, { cuerpo, tk = undefined, permisos } = {}) {
    const jwt = tk === null ? null : (tk ?? await token(permisos));
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { estado: res.status, datos: await res.json().catch(() => null) };
  }

  describe('seguridad', () => {
    it('rechaza sin token (401) y con token ajeno (401)', async () => {
      assert.equal((await llamar('GET', '', { tk: null })).estado, 401);
      const ajeno = await new SignJWT({ typ: 'ACCESO', permisos: TODOS })
        .setProtectedHeader({ alg: 'HS256' }).setIssuer(EMISOR).setSubject(USUARIO).setExpirationTime('5m')
        .sign(new TextEncoder().encode('otro-secreto-distinto-de-32-caracteres!!'));
      assert.equal((await llamar('GET', '', { tk: ajeno })).estado, 401);
    });

    it('rechaza un token de refresco (401)', async () => {
      const refresco = await token([], { typ: 'REFRESCO' });
      assert.equal((await llamar('GET', '', { tk: refresco })).estado, 401);
    });

    it('exige el permiso de cada operación (403)', async () => {
      assert.equal((await llamar('POST', '', { cuerpo: cuerpoBase(), permisos: ['radicados:consultar'] })).estado, 403);
      assert.equal((await llamar('GET', '', { permisos: ['radicados:crear'] })).estado, 403);
    });
  });

  describe('crear (HU-017, HU-018, HU-019)', () => {
    it('genera AAAAMMDD + X + consecutivo y lo incrementa por día y origen', async () => {
      const hoy = fechaLocal(new Date()).replaceAll('-', '');
      const a = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), origen: 'EXTERNO' } });
      const b = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), origen: 'EXTERNO' } });
      const c = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), origen: 'INTERNO' } });
      assert.equal(a.estado, 201);
      assert.equal(a.datos.codigo, `${hoy}20001`);
      assert.equal(b.datos.codigo, `${hoy}20002`);
      assert.equal(c.datos.codigo, `${hoy}10001`);
      assert.equal(a.datos.clase, 'ORIGINAL');
      assert.equal(a.datos.areaId, AREA, 'por defecto toma el área del usuario');
      assert.equal(a.datos.radicadoPor, USUARIO);
    });

    it('no repite códigos con solicitudes simultáneas', async () => {
      const resultados = await Promise.all(Array.from({ length: 25 }, () => llamar('POST', '', { cuerpo: cuerpoBase() })));
      const codigos = new Set(resultados.map((r) => r.datos.codigo));
      assert.equal(codigos.size, 25);
    });

    it('valida los metadatos obligatorios con mensajes legibles', async () => {
      const { estado, datos } = await llamar('POST', '', { cuerpo: { origen: 'INTERNO', folios: 0, fechaDocumento: '2026-13-40' } });
      assert.equal(estado, 400);
      assert.equal(datos.codigo, 'REGLA_INVALIDA');
      const texto = datos.detalles.join(' | ');
      assert.match(texto, /asunto es obligatorio/i);
      assert.match(texto, /remitente es obligatorio/i);
      assert.match(texto, /folios deben ser al menos 1/i);
      assert.match(texto, /fecha no es válida/i);
    });

    it('rechaza el origen NO_RADICABLE y campos desconocidos', async () => {
      assert.equal((await llamar('POST', '', { cuerpo: { ...cuerpoBase(), origen: 'NO_RADICABLE' } })).estado, 400);
      assert.equal((await llamar('POST', '', { cuerpo: { ...cuerpoBase(), codigo: '20260101' + '10001' } })).estado, 400);
    });

    it('rechaza una fecha de documento futura', async () => {
      const manana = fechaLocal(new Date(Date.now() + 2 * 86_400_000));
      const { estado, datos } = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), fechaDocumento: manana } });
      assert.equal(estado, 400);
      assert.match(datos.mensaje, /futura/);
    });

    it('valida el tipo documental contra el catálogo', async () => {
      const inexistente = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), tipoDocumentalId: '99999999-9999-4999-8999-999999999999' } });
      assert.match(inexistente.datos.mensaje, /no existe/);
      const inactivo = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), tipoDocumentalId: TIPO_INACTIVO } });
      assert.match(inactivo.datos.mensaje, /inactivo/);
      const origen = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), tipoDocumentalId: TIPO_SOLO_INTERNO, origen: 'EXTERNO' } });
      assert.match(origen.datos.mensaje, /no admite documentos de origen EXTERNO/);
    });

    it('registra el evento radicado.creado en el outbox', async () => {
      const antes = repo._eventos.length;
      const { datos } = await llamar('POST', '', { cuerpo: cuerpoBase() });
      assert.equal(repo._eventos.length, antes + 1);
      const evento = repo._eventos.at(-1);
      assert.equal(evento.tipo, 'radicado.creado');
      assert.equal(evento.entidadId, datos.id);
      assert.equal(evento.estadoPublicacion, 'PENDIENTE');
    });
  });

  describe('origen Recibido y clase (HU-024, HU-040)', () => {
    it('solo quien tiene radicados:radicar-recibido radica Recibidos', async () => {
      const sin = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), origen: 'RECIBIDO' } });
      assert.equal(sin.estado, 403);
      assert.match(sin.datos.mensaje, /Radicador/);
      const con = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), origen: 'RECIBIDO' }, permisos: [...TODOS, 'radicados:radicar-recibido'] });
      assert.equal(con.estado, 201);
      assert.match(con.datos.codigo, /^\d{8}3\d{4}$/);
    });

    it('marcar Copia exige radicados:clase', async () => {
      const permisos = TODOS.filter((p) => p !== 'radicados:clase');
      assert.equal((await llamar('POST', '', { cuerpo: { ...cuerpoBase(), clase: 'COPIA' }, permisos })).estado, 403);
      const ok = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), clase: 'COPIA' } });
      assert.equal(ok.datos.clase, 'COPIA');
    });
  });

  describe('consulta (HU-020, HU-023)', () => {
    it('devuelve el detalle y 404 si no existe o el id está mal formado', async () => {
      const { datos } = await llamar('POST', '', { cuerpo: cuerpoBase() });
      const ok = await llamar('GET', `/${datos.id}`);
      assert.equal(ok.estado, 200);
      assert.equal(ok.datos.codigo, datos.codigo);
      assert.equal((await llamar('GET', '/99999999-9999-4999-8999-999999999999')).estado, 404);
      assert.equal((await llamar('GET', '/no-es-un-uuid')).estado, 404);
    });

    it('filtra por texto, origen, código y pagina', async () => {
      const unico = `Contrato-${Date.now()}`;
      await llamar('POST', '', { cuerpo: { ...cuerpoBase(), asunto: unico, origen: 'EXTERNO' } });
      const porTexto = await llamar('GET', `?q=${unico}`);
      assert.equal(porTexto.datos.total, 1);
      assert.equal((await llamar('GET', `?q=${unico}&origen=INTERNO`)).datos.total, 0);
      const codigo = porTexto.datos.contenido[0].codigo;
      assert.equal((await llamar('GET', `?codigo=${codigo}`)).datos.total, 1);
      const pagina = await llamar('GET', '?tamanio=2&pagina=0');
      assert.equal(pagina.datos.contenido.length, 2);
      assert.ok(pagina.datos.total > 2);
    });

    it('filtra por rango de fechas y valida los parámetros', async () => {
      const hoy = fechaLocal(new Date());
      assert.ok((await llamar('GET', `?desde=${hoy}&hasta=${hoy}`)).datos.total > 0);
      assert.equal((await llamar('GET', '?hasta=2020-01-01')).datos.total, 0);
      assert.equal((await llamar('GET', '?desde=2026-02-01&hasta=2026-01-01')).estado, 400);
      assert.equal((await llamar('GET', '?origen=OTRO')).estado, 400);
      assert.equal((await llamar('GET', '?tamanio=5000')).estado, 400);
    });
  });

  describe('edición (HU-021, HU-039)', () => {
    it('edita los metadatos sin tocar el código y sube la versión', async () => {
      const { datos } = await llamar('POST', '', { cuerpo: cuerpoBase() });
      const res = await llamar('PUT', `/${datos.id}`, { cuerpo: { version: 0, asunto: 'Asunto corregido', comentarios: 'Con nota', folios: 3 } });
      assert.equal(res.estado, 200);
      assert.equal(res.datos.codigo, datos.codigo);
      assert.equal(res.datos.asunto, 'Asunto corregido');
      assert.equal(res.datos.folios, 3);
      assert.equal(res.datos.version, 1);
      assert.equal(res.datos.actualizadoPor, USUARIO);
      assert.equal(repo._eventos.at(-1).tipo, 'radicado.editado');
    });

    it('no permite cambiar código ni origen', async () => {
      const { datos } = await llamar('POST', '', { cuerpo: cuerpoBase() });
      assert.equal((await llamar('PUT', `/${datos.id}`, { cuerpo: { version: 0, codigo: 'X' } })).estado, 400);
      assert.equal((await llamar('PUT', `/${datos.id}`, { cuerpo: { version: 0, origen: 'EXTERNO' } })).estado, 400);
    });

    it('responde 409 si otra persona editó antes (bloqueo optimista)', async () => {
      const { datos } = await llamar('POST', '', { cuerpo: cuerpoBase() });
      assert.equal((await llamar('PUT', `/${datos.id}`, { cuerpo: { version: 0, asunto: 'Primera' } })).estado, 200);
      const tarde = await llamar('PUT', `/${datos.id}`, { cuerpo: { version: 0, asunto: 'Segunda' } });
      assert.equal(tarde.estado, 409);
      assert.equal((await llamar('GET', `/${datos.id}`)).datos.asunto, 'Primera');
    });

    it('exige permiso para editar y para cambiar la clase', async () => {
      const { datos } = await llamar('POST', '', { cuerpo: cuerpoBase() });
      assert.equal((await llamar('PUT', `/${datos.id}`, { cuerpo: { version: 0 }, permisos: ['radicados:consultar'] })).estado, 403);
      const sinClase = TODOS.filter((p) => p !== 'radicados:clase');
      assert.equal((await llamar('PUT', `/${datos.id}`, { cuerpo: { version: 0, clase: 'COPIA' }, permisos: sinClase })).estado, 403);
    });

    it('el tipo nuevo debe admitir el origen del radicado', async () => {
      const { datos } = await llamar('POST', '', { cuerpo: { ...cuerpoBase(), origen: 'EXTERNO' } });
      const res = await llamar('PUT', `/${datos.id}`, { cuerpo: { version: 0, tipoDocumentalId: TIPO_SOLO_INTERNO } });
      assert.equal(res.estado, 400);
    });

    it('404 al editar un radicado inexistente', async () => {
      assert.equal((await llamar('PUT', '/99999999-9999-4999-8999-999999999999', { cuerpo: { version: 0 } })).estado, 404);
    });
  });

  it('responde JSON inválido con 400', async () => {
    const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: '{no es json' });
    assert.equal(res.status, 400);
  });
});
