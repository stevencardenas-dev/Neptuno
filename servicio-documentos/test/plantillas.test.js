import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { crearServicioPlantillas } from '../src/plantillas/servicio.js';
import { crearPdf, marcadoresDe, marcadoresDeDocx, renderizarDocx, renderizarXml, textoDeDocx } from '../src/plantillas/documento.js';
import { validarDocx } from '../src/plantillas/modelo.js';

// HU-035…HU-038: una plantilla DOCX es un ZIP con marcadores; al generar se reemplazan
// con los datos del radicado y se producen DOCX y PDF que quedan como anexos.

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PLANTILLA = uuid(1);
const RADICADO = uuid(2);
const ACTOR = { id: uuid(3), correo: 'ana@neptuno.gov.co', token: 'token' };
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function docx(documentXml) {
  const zip = new JSZip();
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${documentXml}</w:body>
</w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('los marcadores se detectan aunque Word los parta en varios runs', async () => {
  const xml = `<w:p><w:r><w:t>{{</w:t></w:r><w:r><w:t>asunto</w:t></w:r><w:r><w:t>}}</w:t></w:r>` +
    `<w:r><w:t> y {{folios}}</w:t></w:r></w:p>`;
  assert.deepEqual(marcadoresDe(xml), ['asunto', 'folios']);
  assert.deepEqual(await marcadoresDeDocx(await docx(xml)), ['asunto', 'folios']);
});

test('el render reemplaza el marcador entero y el partido, y escapa el XML', async () => {
  const xml = `<w:p><w:r><w:t>{{asunto}}</w:t></w:r><w:r><w:t>{{</w:t></w:r><w:r><w:t>folios</w:t></w:r><w:r><w:t>}}</w:t></w:r></w:p>`;
  const salida = renderizarXml(xml, { asunto: 'Acta & anexos <1>', folios: 3 });
  assert.match(salida, /Acta &amp; anexos &lt;1&gt;/);
  assert.match(salida, />3</);
  assert.doesNotMatch(salida, /\{\{/);
});

test('un marcador sin valor se conserva para que se note', () => {
  const salida = renderizarXml('<w:t>{{asunto}}</w:t>', {});
  assert.match(salida, /\{\{asunto\}\}/);
});

test('el DOCX renderizado sigue siendo un ZIP y conserva el texto', async () => {
  const original = await docx('<w:p><w:r><w:t>{{asunto}}</w:t></w:r></w:p>');
  const salida = await renderizarDocx(original, { asunto: 'Contrato de suministro' });
  assert.equal(salida.subarray(0, 2).toString(), 'PK');
  assert.equal(await textoDeDocx(salida), 'Contrato de suministro');
});

test('el PDF generado tiene cabecera, texto y cierre', () => {
  const pdf = crearPdf('Acta de visita\nRadicado 20261028010001', 'Acta');
  const texto = pdf.toString('latin1');
  assert.ok(texto.startsWith('%PDF-1.4'));
  assert.match(texto, /\(Acta de visita\) Tj/);
  assert.match(texto, /\/BaseFont \/Helvetica/);
  assert.ok(texto.trimEnd().endsWith('%%EOF'));
  assert.match(texto, /startxref\n\d+\n/);
});

test('solo se aceptan DOCX con su tipo declarado', () => {
  assert.equal(validarDocx({ nombre: 'acta.docx', tipoMime: DOCX_MIME, contenido: Buffer.from('x') }).nombreOriginal, 'acta.docx');
  assert.throws(() => validarDocx({ nombre: 'acta.pdf', tipoMime: DOCX_MIME, contenido: Buffer.from('x') }), /\.docx/);
  assert.throws(() => validarDocx({ nombre: 'acta.docx', tipoMime: 'application/pdf', contenido: Buffer.from('x') }), /no corresponde/);
});

function escenario({ variables = [{ etiqueta: 'asunto', campoOrigen: 'asunto', obligatoria: true }], origenes = ['INTERNO'], datosRadicado = {} } = {}) {
  const plantilla = {
    id: PLANTILLA, nombre: 'Acta', version: 1, estado: 'ACTIVA', objetoClave: 'plantillas/acta.docx',
    variables, origenes,
  };
  const radicado = {
    id: RADICADO, codigo: '20261028010001', origen: 'INTERNO', clase: 'ORIGINAL',
    asunto: 'Solicitud de compra', remitente: 'Ana', destinatario: 'Compras', folios: 2,
    fechaDocumento: '2026-10-28', comentarios: null, ...datosRadicado,
  };
  const generados = [];
  const anexosGuardados = [];
  const repo = {
    obtener: async (id) => (id === PLANTILLA ? plantilla : null),
    radicado: async (id) => (id === RADICADO ? radicado : null),
    crearGenerado: async (datos) => {
      generados.push(datos);
      return { id: uuid(99), ...datos };
    },
  };
  const anexos = {
    cargarGenerados: async (_actor, _radicado, archivos) => {
      anexosGuardados.push(...archivos);
      return archivos.map((archivo, indice) => ({ id: uuid(70 + indice), nombreOriginal: archivo.nombre }));
    },
  };
  const servicio = crearServicioPlantillas({ repo, anexos, almacen: { leer: async () => docx('<w:p><w:r><w:t>{{asunto}}</w:t></w:r></w:p>') } });
  return { servicio, generados, anexosGuardados };
}

test('generar usa los datos del radicado y produce DOCX y PDF con procedencia de plantilla', async () => {
  const { servicio, generados, anexosGuardados } = escenario();
  const resultado = await servicio.generar(ACTOR, RADICADO, { plantillaId: PLANTILLA, datos: {} });
  assert.equal(generados.length, 1);
  assert.equal(generados[0].datos.asunto, 'Solicitud de compra');
  assert.equal(anexosGuardados.length, 2);
  assert.equal(anexosGuardados[0].tipoMime, DOCX_MIME);
  assert.equal(anexosGuardados[1].tipoMime, 'application/pdf');
  assert.match(anexosGuardados[1].nombre, /\.pdf$/);
  assert.equal(resultado.pdf.id, uuid(71));
});

test('los datos enviados mandan sobre los del radicado', async () => {
  const { servicio, generados } = escenario();
  await servicio.generar(ACTOR, RADICADO, { plantillaId: PLANTILLA, datos: { asunto: 'Otro asunto' } });
  assert.equal(generados[0].datos.asunto, 'Otro asunto');
});

test('si falta una variable obligatoria no se genera nada', async () => {
  const { servicio, generados, anexosGuardados } = escenario({ datosRadicado: { asunto: '' } });
  await assert.rejects(
    servicio.generar(ACTOR, RADICADO, { plantillaId: PLANTILLA, datos: {} }),
    (error) => error.estado === 400 && error.detalles.includes('{{asunto}}'),
  );
  assert.equal(generados.length, 0);
  assert.equal(anexosGuardados.length, 0);
});

test('una plantilla no se usa con un origen al que no está vinculada', async () => {
  const { servicio, generados } = escenario({ origenes: ['EXTERNO'] });
  await assert.rejects(
    servicio.generar(ACTOR, RADICADO, { plantillaId: PLANTILLA, datos: {} }),
    (error) => error.estado === 400 && /origen INTERNO/.test(error.message),
  );
  assert.equal(generados.length, 0);
});
