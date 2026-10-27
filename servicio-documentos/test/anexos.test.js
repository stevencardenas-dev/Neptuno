import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extensionDe, nombreLimpio, validarArchivo, EXTENSIONES, TAMANIO_MAXIMO } from '../src/anexos/modelo.js';

// HU-025…HU-027: antes de escribir en el almacén se valida el nombre, la extensión, la
// compatibilidad con el tipo MIME y el tamaño. Estas pruebas fijan esas cuatro reglas y el
// caso del nombre que llega con la ruta del equipo de origen.

const pdf = { nombre: 'solicitud.pdf', tipoMime: 'application/pdf', tamano: 2048 };

test('un PDF válido devuelve el nombre limpio y el MIME normalizado', () => {
  assert.deepEqual(validarArchivo({ ...pdf, tipoMime: 'Application/PDF; charset=binary' }), {
    nombreOriginal: 'solicitud.pdf',
    extension: 'pdf',
    tipoMime: 'application/pdf',
  });
});

test('el nombre se queda con la última parte de la ruta y se recorta a 255 caracteres', () => {
  assert.equal(nombreLimpio('C:\\Users\\ana\\Escritorio\\oficio.docx'), 'oficio.docx');
  assert.equal(nombreLimpio('/tmp/acta.png'), 'acta.png');
  assert.equal(nombreLimpio(`${'a'.repeat(300)}.pdf`).length, 255);
});

test('la extensión se lee sin importar mayúsculas', () => {
  assert.equal(extensionDe('ACTA.PDF'), 'pdf');
  assert.equal(extensionDe('sin-extension'), '');
  assert.equal(extensionDe('.oculto'), '');
});

test('el archivo sin nombre no se acepta', () => {
  assert.throws(() => validarArchivo({ ...pdf, nombre: '   ' }), /necesita un nombre/);
});

test('solo se admiten las extensiones del catálogo', () => {
  assert.deepEqual(EXTENSIONES, ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx']);
  assert.throws(
    () => validarArchivo({ nombre: 'programa.exe', tipoMime: 'application/octet-stream', tamano: 10 }),
    /Solo se admiten archivos/,
  );
});

test('un ejecutable renombrado a .pdf se rechaza por el tipo MIME', () => {
  assert.throws(
    () => validarArchivo({ ...pdf, tipoMime: 'application/x-msdownload' }),
    /no corresponde a la extensión \.pdf/,
  );
  assert.throws(() => validarArchivo({ ...pdf, tipoMime: '' }), /"desconocido"/);
});

test('un archivo vacío o sin tamaño se rechaza', () => {
  assert.throws(() => validarArchivo({ ...pdf, tamano: 0 }), /está vacío/);
  assert.throws(() => validarArchivo({ ...pdf, tamano: Number.NaN }), /está vacío/);
});

test('el máximo por archivo es de 10 MB', () => {
  assert.equal(TAMANIO_MAXIMO, 10 * 1024 * 1024);
  assert.throws(() => validarArchivo({ ...pdf, tamano: TAMANIO_MAXIMO + 1 }), /supera el máximo de 10 MB/);
  assert.doesNotThrow(() => validarArchivo({ ...pdf, tamano: TAMANIO_MAXIMO }));
});
