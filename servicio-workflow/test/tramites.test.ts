import assert from 'node:assert/strict';
import { test } from 'node:test';
import { esquemaEjecutar, esquemaIniciar } from '../src/tramites/modelo';

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
