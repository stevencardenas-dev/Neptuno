import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { migrar } from '../src/migrar.js';
import { crearRepositorioMysql } from '../src/radicados/repositorio-mysql.js';

// Prueba el repositorio contra un MySQL real. Se omite si no se define PRUEBA_MYSQL_HOST
// (en CI lo aporta el servicio mysql del workflow). Usa una base propia que se recrea.
// Variables: PRUEBA_MYSQL_HOST, PRUEBA_MYSQL_PORT, PRUEBA_MYSQL_USUARIO, PRUEBA_MYSQL_CLAVE.
const activo = Boolean(process.env.PRUEBA_MYSQL_HOST);

describe('repositorio MySQL', { skip: !activo && 'define PRUEBA_MYSQL_HOST para ejecutarla' }, () => {
  let pool, repo;
  const cfg = () => ({
    host: process.env.PRUEBA_MYSQL_HOST,
    port: Number(process.env.PRUEBA_MYSQL_PORT ?? 3306),
    user: process.env.PRUEBA_MYSQL_USUARIO ?? 'root',
    password: process.env.PRUEBA_MYSQL_CLAVE ?? '',
  });
  const datos = (extra = {}) => ({
    origen: 'INTERNO', clase: 'ORIGINAL', tipoDocumentalId: randomUUID(), areaId: randomUUID(),
    asunto: 'Asunto', remitente: 'R', destinatario: 'D', fechaDocumento: '2026-10-07', folios: 1,
    entidadId: null, comentarios: null, estado: 'RADICADO', radicadoPor: randomUUID(), radicadoEn: new Date(), ...extra,
  });
  const evento = (tipo) => (r) => ({ tipo, entidad: 'radicado', entidadId: r.id, actorId: r.radicadoPor, actorCorreo: 'a@b.co', detalle: r.codigo });

  before(async () => {
    const admin = await mysql.createConnection(cfg());
    await admin.query('drop database if exists documentos_prueba');
    await admin.query('create database documentos_prueba default character set utf8mb4');
    await admin.end();
    pool = mysql.createPool({ ...cfg(), database: 'documentos_prueba', timezone: 'Z', dateStrings: ['DATE'] });
    await migrar(pool, { info() {} });
    repo = crearRepositorioMysql(pool);
  });
  after(async () => {
    await pool.query('drop database documentos_prueba');
    await pool.end();
  });

  it('la migración es idempotente', async () => {
    await migrar(pool, { info() {} });
    const [[{ n }]] = await pool.query('select count(*) n from schema_migraciones');
    assert.equal(n, 1);
  });

  it('asigna consecutivos únicos y sin saltos con inserciones simultáneas', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 30 }, () => repo.insertar(datos({ origen: 'EXTERNO' }), { fecha: '2026-10-07' }, evento('radicado.creado'))),
    );
    const codigos = resultados.map((r) => r.codigo).sort();
    assert.equal(new Set(codigos).size, 30);
    assert.equal(codigos[0], '2026100720001');
    assert.equal(codigos[29], '2026100720030');
  });

  it('reinicia el consecutivo por día y por origen', async () => {
    assert.equal((await repo.insertar(datos({ origen: 'INTERNO' }), { fecha: '2026-10-07' }, evento('x'))).codigo, '2026100710001');
    assert.equal((await repo.insertar(datos({ origen: 'EXTERNO' }), { fecha: '2026-10-08' }, evento('x'))).codigo, '2026100820001');
  });

  it('un insert fallido no consume el consecutivo', async () => {
    await assert.rejects(repo.insertar(datos({ folios: 0 }), { fecha: '2026-11-01' }, evento('x')));
    assert.equal((await repo.insertar(datos(), { fecha: '2026-11-01' }, evento('x'))).codigo, '2026110110001');
  });

  it('lee de vuelta los mismos datos (uuid, fechas y nulos)', async () => {
    const d = datos({ comentarios: 'nota' });
    const creado = await repo.insertar(d, { fecha: '2026-12-01' }, evento('x'));
    const leido = await repo.obtener(creado.id);
    assert.equal(leido.tipoDocumentalId, d.tipoDocumentalId);
    assert.equal(leido.areaId, d.areaId);
    assert.equal(leido.fechaDocumento, '2026-10-07');
    assert.equal(leido.comentarios, 'nota');
    assert.equal(leido.entidadId, null);
    assert.equal(leido.version, 0);
    assert.equal(await repo.obtener(randomUUID()), null);
  });

  it('actualiza con bloqueo optimista y conserva el código', async () => {
    const creado = await repo.insertar(datos(), { fecha: '2026-12-02' }, evento('x'));
    const nuevo = await repo.actualizar(creado.id, 0, { asunto: 'Nuevo', folios: 4, actualizadoPor: randomUUID(), actualizadoEn: new Date() }, evento('radicado.editado'));
    assert.equal(nuevo.codigo, creado.codigo);
    assert.equal(nuevo.asunto, 'Nuevo');
    assert.equal(nuevo.version, 1);
    await assert.rejects(repo.actualizar(creado.id, 0, { asunto: 'Tarde' }, evento('x')), { estado: 409 });
    await assert.rejects(repo.actualizar(randomUUID(), 0, { asunto: 'X' }, evento('x')), { estado: 404 });
  });

  it('busca con filtros, escapa comodines y pagina', async () => {
    await repo.insertar(datos({ asunto: 'Pago 100% anticipado' }), { fecha: '2026-12-03' }, evento('x'));
    assert.equal((await repo.buscar({ q: '100%', pagina: 0, tamanio: 20 })).total, 1);
    assert.equal((await repo.buscar({ q: '%', pagina: 0, tamanio: 20 })).total, 1, 'el % no es comodín');
    const pagina = await repo.buscar({ origen: 'EXTERNO', pagina: 1, tamanio: 10 });
    assert.equal(pagina.contenido.length, 10);
    assert.ok(pagina.total >= 31);
    const hoy = new Date().toISOString().slice(0, 10);
    assert.ok((await repo.buscar({ desde: hoy, hasta: hoy, pagina: 0, tamanio: 5 })).total > 0);
  });

  it('guarda los eventos en el outbox en la misma transacción y los marca como publicados', async () => {
    const pendientes = await repo.eventosPendientes(1000);
    assert.ok(pendientes.length >= 30);
    assert.equal(pendientes[0].entidad, 'radicado');
    await repo.marcarPublicados(pendientes.map((e) => e.id));
    assert.equal((await repo.eventosPendientes(1000)).length, 0);
  });
});
