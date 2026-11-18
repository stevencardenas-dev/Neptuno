import JSZip from 'jszip';

/**
 * Render de plantillas DOCX y generación del PDF (HU-035, HU-037, HU-038).
 *
 * Un DOCX es un ZIP con XML adentro. Se reemplazan los marcadores `{{variable}}` en el
 * cuerpo, los encabezados y los pies, y se vuelve a comprimir. Word suele partir un
 * marcador en varios fragmentos (`{{`, `asunto`, `}}` en runs distintos), así que además
 * del reemplazo directo se contempla el marcador partido por etiquetas.
 *
 * El PDF se compone con el texto del documento renderizado, sin conservar el formato
 * gráfico. Es suficiente para anexarlo al radicado sin depender de un conversor externo;
 * la limitación queda documentada en la hoja de ruta.
 */

const XML_ARCHIVOS = /^word\/(document|header\d*|footer\d*)\.xml$/;

const escaparXml = (texto) => String(texto)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const desescaparXml = (texto) => String(texto)
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"')
  .replaceAll('&apos;', "'")
  .replaceAll('&amp;', '&');

/** Marcadores del documento, sin llaves y sin etiquetas XML intercaladas. */
export function marcadoresDe(xml) {
  const encontrados = new Set();
  const patron = /\{\{([\s\S]{0,200}?)\}\}/g;
  let coincidencia;
  while ((coincidencia = patron.exec(xml)) !== null) {
    const etiqueta = coincidencia[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (etiqueta) encontrados.add(etiqueta);
  }
  return [...encontrados].sort((a, b) => a.localeCompare(b));
}

/** Aplica los valores a un XML. Deja el marcador intacto si no hay valor. */
export function renderizarXml(xml, valores) {
  let resultado = xml;
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor === undefined || valor === null) continue;
    const texto = escaparXml(valor).replace(/[\r\n]+/g, ' ');
    const etiqueta = clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Caso normal: el marcador está entero en un solo run.
    resultado = resultado.replace(new RegExp(`\\{\\{\\s*${etiqueta}\\s*\\}\\}`, 'g'), texto);
  }
  // Marcador partido en varios runs: se limpian las etiquetas internas para reconocerlo.
  return resultado.replace(/\{\{([\s\S]{0,200}?)\}\}/g, (completo, interior) => {
    const etiqueta = interior.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const valor = valores[etiqueta];
    if (valor === undefined || valor === null) return completo;
    return escaparXml(valor).replace(/[\r\n]+/g, ' ');
  });
}

/** Abre el DOCX, reemplaza los marcadores de todas las partes y devuelve el ZIP nuevo. */
export async function renderizarDocx(contenido, valores) {
  const zip = await JSZip.loadAsync(contenido);
  const partes = Object.keys(zip.files).filter((nombre) => XML_ARCHIVOS.test(nombre));
  await Promise.all(partes.map(async (nombre) => {
    const xml = await zip.file(nombre).async('string');
    zip.file(nombre, renderizarXml(xml, valores));
  }));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** Marcadores que contiene la plantilla, leídos de su DOCX. */
export async function marcadoresDeDocx(contenido) {
  const zip = await JSZip.loadAsync(contenido);
  const partes = Object.keys(zip.files).filter((nombre) => XML_ARCHIVOS.test(nombre));
  const todos = new Set();
  for (const nombre of partes) {
    for (const marcador of marcadoresDe(await zip.file(nombre).async('string'))) todos.add(marcador);
  }
  return [...todos].sort((a, b) => a.localeCompare(b));
}

/** Texto legible del DOCX renderizado (párrafos y celdas), base del PDF. */
export async function textoDeDocx(contenido) {
  const zip = await JSZip.loadAsync(contenido);
  const xml = await zip.file('word/document.xml').async('string');
  const texto = xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, '\t')
    .replace(/<[^>]+>/g, '');
  return desescaparXml(texto).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Ajusta el texto a líneas de un ancho aproximado, respetando los saltos. */
function lineasDe(texto, ancho = 92) {
  const lineas = [];
  for (const parrafo of String(texto ?? '').split('\n')) {
    if (!parrafo.trim()) {
      lineas.push('');
      continue;
    }
    let restante = parrafo;
    while (restante.length > ancho) {
      let corte = restante.lastIndexOf(' ', ancho);
      if (corte <= 0) corte = ancho;
      lineas.push(restante.slice(0, corte));
      restante = restante.slice(corte).trimStart();
    }
    lineas.push(restante);
  }
  return lineas;
}

/** Escapa el texto para una cadena literal PDF. */
function cadenaPdf(texto) {
  return String(texto)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x00-\xFF]/g, '?');
}

/**
 * PDF 1.4 mínimo con una fuente Helvetica y el texto en páginas de carta. No usa
 * compresión: el contenido se puede leer en el archivo y no hace falta una dependencia.
 */
export function crearPdf(texto, titulo = 'Documento') {
  const ancho = 595;
  const alto = 842;
  const margen = 50;
  const porPagina = 56;
  const lineas = lineasDe(texto);
  const paginas = [];
  for (let i = 0; i < Math.max(1, lineas.length); i += porPagina) {
    paginas.push(lineas.slice(i, i + porPagina));
  }

  const objetos = [];
  const paginaIds = [];
  // 1 catálogo, 2 páginas, 3 fuente, 4 información; los pares contenido/página siguen.
  let siguiente = 5;
  for (const pagina of paginas) {
    const contenidoId = siguiente++;
    const paginaId = siguiente++;
    paginaIds.push(paginaId);
    const cuerpo = [
      'BT',
      '/F1 11 Tf',
      `${margen} ${alto - margen} Td`,
      '14 TL',
      ...pagina.flatMap((linea) => [`(${cadenaPdf(linea)}) Tj`, 'T*']),
      'ET',
    ].join('\n');
    objetos.push({ id: contenidoId, cuerpo: `<< /Length ${Buffer.byteLength(cuerpo, 'latin1')} >>\nstream\n${cuerpo}\nendstream` });
    objetos.push({
      id: paginaId,
      cuerpo: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ancho} ${alto}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contenidoId} 0 R >>`,
    });
  }

  objetos.push(
    { id: 1, cuerpo: '<< /Type /Catalog /Pages 2 0 R >>' },
    { id: 2, cuerpo: `<< /Type /Pages /Kids [${paginaIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${paginaIds.length} >>` },
    { id: 3, cuerpo: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
    { id: 4, cuerpo: `<< /Title (${cadenaPdf(titulo)}) /Producer (Neptuno ms-document-management) >>` },
  );
  objetos.sort((a, b) => a.id - b.id);

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const objeto of objetos) {
    offsets[objeto.id] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${objeto.id} 0 obj\n${objeto.cuerpo}\nendobj\n`;
  }
  const inicioXref = Buffer.byteLength(pdf, 'latin1');
  const total = Math.max(...objetos.map((objeto) => objeto.id)) + 1;
  pdf += `xref\n0 ${total}\n`;
  pdf += '0000000000 65535 f \n';
  for (let id = 1; id < total; id += 1) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${total} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
