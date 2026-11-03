import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearServicioAnexos, MAX_ARCHIVOS_POR_LOTE } from '../src/anexos/servicio.js';

// HU-027: varios archivos en una sola petición. Todo el lote se valida antes de tocar el
// almacén y, si la base falla, los objetos ya subidos se eliminan.

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const RADICADO = uuid(1);
const ACTOR = { id: uuid(2), correo: 'ana@neptuno.gov.co' };
const PDF = { nombre: 'anexo.pdf', tipoMime: 'application/pdf', contenido: Buffer.from('%PDF-1.4 contenido') };

function escenario({ fallaBase = false } = {}) {
  const guardados = [];
  const eliminados = [];
  const insertados = [];
  const repo = {
    radicadoExiste: async () => 'RADICADO',
    documentoExpedienteExiste: async () => true,
    insertarLote: async (anexos) => {
      if (fallaBase) throw Object.assign(new Error('la base falló'), { estado: 500 });
      insertados.push(...anexos);
      return anexos.map((anexo, indice) => ({ id: uuid(100 + indice), ...anexo }));
    },
  };
  const almacen = {
    guardar: async (clave, contenido, tipoMime) => guardados.push({ clave, contenido, tipoMime }),
    eliminar: async (clave) => eliminados.push(clave),
  };
  return { servicio: crearServicioAnexos({ repo, almacen }), guardados, eliminados, insertados };
}

test('un lote de archivos válidos se guarda y devuelve en orden', async () => {
  const { servicio, guardados, insertados } = escenario();
  const anexos = await servicio.cargarLote(ACTOR, RADICADO, [
    PDF,
    { nombre: 'foto.png', tipoMime: 'image/png', contenido: Buffer.from('\x89PNG contenido') },
  ]);
  assert.equal(guardados.length, 2);
  assert.equal(insertados.length, 2);
  assert.deepEqual(anexos.map((anexo) => anexo.extension), ['pdf', 'png']);
  assert.equal(insertados[0].radicadoId, RADICADO);
  assert.equal(anexos[0].procedencia, 'CARGA');
});

test('un lote con un archivo inválido no sube ninguno', async () => {
  const { servicio, guardados } = escenario();
  await assert.rejects(
    servicio.cargarLote(ACTOR, RADICADO, [PDF, { nombre: 'programa.exe', tipoMime: 'application/octet-stream', contenido: Buffer.from('x') }]),
    /Solo se admiten archivos/,
  );
  assert.equal(guardados.length, 0);
});

test('el lote tiene un máximo de archivos', async () => {
  const { servicio, guardados } = escenario();
  const archivos = Array.from({ length: MAX_ARCHIVOS_POR_LOTE + 1 }, () => PDF);
  await assert.rejects(servicio.cargarLote(ACTOR, RADICADO, archivos), /como máximo 8/);
  assert.equal(guardados.length, 0);
});

test('si la base falla se limpian los objetos ya subidos', async () => {
  const { servicio, eliminados } = escenario({ fallaBase: true });
  await assert.rejects(servicio.cargarLote(ACTOR, RADICADO, [PDF]), /base falló/);
  assert.equal(eliminados.length, 1);
});
