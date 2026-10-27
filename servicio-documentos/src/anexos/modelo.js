import { reglaInvalida } from '../errores.js';

/** Límite por archivo. nginx acepta 20 MB; aquí se corta antes para no llenar la memoria. */
export const TAMANIO_MAXIMO = 10 * 1024 * 1024;

/** HU-026: extensiones admitidas y el tipo MIME con el que se aceptan (minúsculas). */
const MIMES = {
  pdf: ['application/pdf', 'application/x-pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg', 'image/pjpeg'],
  jpeg: ['image/jpeg', 'image/pjpeg'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

export const EXTENSIONES = Object.keys(MIMES);

/** Quita la ruta que algunos navegadores incluyen y recorta el nombre a 255 caracteres. */
export function nombreLimpio(nombre) {
  const base = String(nombre ?? '').split(/[\\/]/).pop()?.trim() ?? '';
  return base.slice(0, 255);
}

export function extensionDe(nombre) {
  const punto = nombre.lastIndexOf('.');
  if (punto <= 0 || punto === nombre.length - 1) return '';
  return nombre.slice(punto + 1).toLowerCase();
}

/**
 * Valida el archivo antes de tocar MinIO. Devuelve la extensión y el MIME normalizado.
 * El tipo MIME del navegador no es confiable, pero se exige compatible con la extensión
 * para no aceptar, por ejemplo, un ejecutable renombrado a .pdf.
 */
export function validarArchivo({ nombre, tipoMime, tamano }) {
  const nombreOriginal = nombreLimpio(nombre);
  if (!nombreOriginal) throw reglaInvalida('El archivo necesita un nombre.');

  const extension = extensionDe(nombreOriginal);
  if (!MIMES[extension]) {
    throw reglaInvalida(`Solo se admiten archivos ${EXTENSIONES.join(', ')}.`);
  }

  const mime = String(tipoMime ?? '').split(';')[0].trim().toLowerCase();
  if (!MIMES[extension].includes(mime)) {
    throw reglaInvalida(`El tipo de archivo "${mime || 'desconocido'}" no corresponde a la extensión .${extension}.`);
  }

  if (!Number.isFinite(tamano) || tamano <= 0) {
    throw reglaInvalida('El archivo está vacío.');
  }
  if (tamano > TAMANIO_MAXIMO) {
    throw reglaInvalida(`El archivo supera el máximo de ${TAMANIO_MAXIMO / (1024 * 1024)} MB.`);
  }

  return { nombreOriginal, extension, tipoMime: mime };
}
