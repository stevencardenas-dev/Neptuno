import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detallesDe, esquemaCrear, esquemaFiltros } from '../src/flujos/modelo';

// Los filtros llegan como texto desde la barra de direcciones. La regresión que motivó
// estas pruebas: el desplegable «Todos los estados» manda `estado=`, y tratar ese vacío
// como un estado inválido devolvía un 400 que dejaba la tabla en blanco.

test('los filtros vacíos no filtran nada', () => {
  const analisis = esquemaFiltros.safeParse({ q: '', estado: '', pagina: '0', tamanio: '15' });
  assert.equal(analisis.success, true);
  if (!analisis.success) return;
  assert.equal(analisis.data.q, undefined);
  assert.equal(analisis.data.estado, undefined);
  assert.equal(analisis.data.pagina, 0);
  assert.equal(analisis.data.tamanio, 15);
});

test('el estado solo admite los tres valores del flujo', () => {
  const valido = esquemaFiltros.safeParse({ estado: 'ACTIVO' });
  assert.equal(valido.success, true);
  if (valido.success) assert.equal(valido.data.estado, 'ACTIVO');

  const invalido = esquemaFiltros.safeParse({ estado: 'PUBLICADO' });
  assert.equal(invalido.success, false);
});

test('la búsqueda se recorta y no admite texto desmedido', () => {
  const analisis = esquemaFiltros.safeParse({ q: '  viáticos  ' });
  assert.equal(analisis.success, true);
  if (analisis.success) assert.equal(analisis.data.q, 'viáticos');

  assert.equal(esquemaFiltros.safeParse({ q: 'x'.repeat(121) }).success, false);
});

test('la paginación tiene topes', () => {
  assert.equal(esquemaFiltros.safeParse({ tamanio: '0' }).success, false);
  assert.equal(esquemaFiltros.safeParse({ tamanio: '101' }).success, false);
  assert.equal(esquemaFiltros.safeParse({ pagina: '-1' }).success, false);
  const sinDatos = esquemaFiltros.safeParse({});
  assert.equal(sinDatos.success, true);
  if (sinDatos.success) {
    assert.equal(sinDatos.data.pagina, 0);
    assert.equal(sinDatos.data.tamanio, 20);
  }
});

test('el nombre del flujo es obligatorio y los detalles se explican campo a campo', () => {
  const corto = esquemaCrear.safeParse({ nombre: 'ab' });
  assert.equal(corto.success, false);
  if (!corto.success) {
    const detalles = detallesDe(corto.error);
    assert.equal(detalles.length, 1);
    assert.match(detalles[0], /^nombre: /);
  }

  const vacio = esquemaCrear.safeParse({});
  assert.equal(vacio.success, false);
});

test('la descripción es opcional y puede quedar en blanco', () => {
  for (const valor of [undefined, null, '', '   ']) {
    const analisis = esquemaCrear.safeParse({ nombre: 'Viáticos', descripcion: valor });
    assert.equal(analisis.success, true, `debería aceptar ${JSON.stringify(valor)}`);
  }
});
