import assert from 'node:assert/strict';
import { test } from 'node:test';
import { esId, esquemaPasoCrear, esquemaPasoEditar, esquemaResponsable, esquemaTransicionCrear } from '../src/disenador/modelo';
import type { Paso, Transicion } from '../src/disenador/modelo';
import { validarPublicacion } from '../src/disenador/validacion';

// HU-061: publicar exige un flujo completo. Estas pruebas fijan las tres reglas del
// backlog —paso inicial, pasos finales y pasos aislados— porque son las que deciden si un
// flujo puede entrar en operación.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const paso = (n: number, tipo: Paso['tipo'], nombre = `Paso ${n}`): Paso => ({
  id: uuid(n),
  nombre,
  descripcion: null,
  tipo,
  posicionX: n * 220,
  posicionY: 140,
  responsables: [],
});

const transicion = (origen: number, destino: number, accion: Transicion['accion'] = 'APROBAR'): Transicion => ({
  id: uuid(90 + origen),
  estadoOrigenId: uuid(origen),
  estadoDestinoId: uuid(destino),
  accion,
  etiqueta: null,
});

test('un flujo sin pasos no se publica', () => {
  const problemas = validarPublicacion([], []);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0]!, /no tiene pasos/);
});

test('un flujo completo no reporta problemas', () => {
  const pasos = [paso(1, 'INICIAL', 'Recibido'), paso(2, 'INTERMEDIO', 'Revisión'), paso(3, 'FINAL', 'Aprobado')];
  const transiciones = [transicion(1, 2), transicion(2, 3)];
  assert.deepEqual(validarPublicacion(pasos, transiciones), []);
});

test('un flujo sin inicial ni final dice qué falta', () => {
  const pasos = [paso(1, 'INTERMEDIO'), paso(2, 'INTERMEDIO')];
  const problemas = validarPublicacion(pasos, [transicion(1, 2), transicion(2, 1)]);
  assert.equal(problemas.length, 2);
  assert.match(problemas.join(' '), /Falta marcar el paso inicial/);
  assert.match(problemas.join(' '), /Falta marcar al menos un paso final/);
});

test('un paso al que no se llega queda aislado y se reporta', () => {
  const pasos = [paso(1, 'INICIAL', 'Recibido'), paso(2, 'FINAL', 'Aprobado'), paso(3, 'INTERMEDIO', 'Huérfano')];
  const transiciones = [transicion(1, 2), transicion(3, 2)];
  const problemas = validarPublicacion(pasos, transiciones);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0]!, /«Huérfano» no se alcanza desde el inicio/);
});

test('un paso intermedio sin salidas deja el trámite a medias', () => {
  const pasos = [paso(1, 'INICIAL'), paso(2, 'FINAL'), paso(3, 'INTERMEDIO', 'Sin salida')];
  const problemas = validarPublicacion(pasos, [transicion(1, 2), transicion(1, 3)]);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0]!, /«Sin salida» no tiene ninguna salida/);
});

test('un paso final con salidas está mal marcado', () => {
  const pasos = [paso(1, 'INICIAL'), paso(2, 'FINAL', 'Aprobado'), paso(3, 'FINAL', 'Con salida')];
  const problemas = validarPublicacion(pasos, [transicion(1, 2), transicion(1, 3), transicion(3, 2)]);
  assert.deepEqual(problemas, ['El paso «Con salida» está marcado como final y tiene salidas.']);
});

test('los dos pasos de una transición no pueden ser el mismo', () => {
  const cuerpo = { estadoOrigenId: uuid(1), estadoDestinoId: uuid(1), accion: 'APROBAR' };
  const analisis = esquemaTransicionCrear.safeParse(cuerpo);
  assert.equal(analisis.success, false);
  if (!analisis.success) assert.match(analisis.error.issues[0]!.message, /distintos/);
});

test('un paso nuevo nace intermedio y con nombre recortado', () => {
  const analisis = esquemaPasoCrear.safeParse({ nombre: '  Revisión jurídica  ' });
  assert.equal(analisis.success, true);
  if (!analisis.success) return;
  assert.equal(analisis.data.nombre, 'Revisión jurídica');
  assert.equal(analisis.data.tipo, 'INTERMEDIO');
  assert.equal(analisis.data.posicionX, undefined);

  assert.equal(esquemaPasoCrear.safeParse({ nombre: 'V' }).success, false);
  assert.equal(esquemaPasoCrear.safeParse({ nombre: 'Revisión', tipo: 'PUBLICADO' }).success, false);
  assert.equal(esquemaPasoCrear.safeParse({ nombre: 'Revisión', posicionX: -1 }).success, false);
});

test('editar un paso sin cambios no se acepta como edición', () => {
  assert.equal(esquemaPasoEditar.safeParse({}).success, false);
  assert.equal(esquemaPasoEditar.safeParse({ posicionX: '320', posicionY: '90' }).success, true);
  assert.equal(esquemaPasoEditar.safeParse({ descripcion: null }).success, true);
});

test('el responsable debe ser de un tipo conocido y con identificador válido', () => {
  assert.equal(esquemaResponsable.safeParse({ tipoSujeto: 'ROL', sujetoId: uuid(7) }).success, true);
  assert.equal(esquemaResponsable.safeParse({ tipoSujeto: 'CARGO', sujetoId: uuid(7) }).success, false);
  assert.equal(esquemaResponsable.safeParse({ tipoSujeto: 'AREA', sujetoId: 'no-es-uuid' }).success, false);
  assert.equal(esId(uuid(3)), true);
  assert.equal(esId('hola'), false);
});

// HU-078: la versión nueva se abre sobre la publicada y devuelve el lienzo del borrador.
// La copia de pasos, transiciones y responsables ocurre en SQL (repositorio); aquí se fija
// lo que decide el servicio: validar el id y devolver el borrador.

test('crear una versión valida el identificador antes de tocar nada', async () => {
  const { ServicioDisenador } = await import('../src/disenador/servicio');
  const llamadas: string[] = [];
  const repo = { crearVersion: async (id: string) => void llamadas.push(id) } as any;
  const servicio = new ServicioDisenador(repo, {} as any);
  await assert.rejects(servicio.crearVersion('no-es-uuid', { id: uuid(1), correo: 'a@b.c' } as any), (e: any) => e.getStatus() === 404);
  assert.deepEqual(llamadas, []);
});

test('crear una versión devuelve el lienzo del borrador', async () => {
  const { ServicioDisenador } = await import('../src/disenador/servicio');
  const grafo = { flujoId: uuid(5), version: { id: uuid(6), numero: 2, estado: 'BORRADOR' }, editable: true, pasos: [], transiciones: [] };
  const llamadas: string[] = [];
  const repo = {
    crearVersion: async (id: string) => void llamadas.push(id),
    grafo: async () => grafo,
  } as any;
  const servicio = new ServicioDisenador(repo, {} as any);
  const resultado = await servicio.crearVersion(uuid(5), { id: uuid(1), correo: 'a@b.c' } as any);
  assert.deepEqual(llamadas, [uuid(5)]);
  assert.equal(resultado.version?.numero, 2);
  assert.equal(resultado.editable, true);
});
