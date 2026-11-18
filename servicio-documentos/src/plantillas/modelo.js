import { z } from 'zod';
import { reglaInvalida } from '../errores.js';
import { extensionDe, nombreLimpio, TAMANIO_MAXIMO } from '../anexos/modelo.js';

/** Campos del radicado que pueden precargar una variable (HU-037). */
export const CAMPOS_RADICADO = [
  'codigo', 'origen', 'clase', 'asunto', 'remitente', 'destinatario', 'fechaDocumento',
  'folios', 'comentarios', 'tipoDocumentalId', 'areaId', 'entidadId', 'radicadoEn',
];

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const esquemaPlantillaEditar = z
  .object({
    nombre: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres.').max(120, 'El nombre no puede superar 120 caracteres.').optional(),
    descripcion: z.string().trim().max(500, 'La descripción no puede superar 500 caracteres.').nullish(),
    estado: z.enum(['ACTIVA', 'INACTIVA']).optional(),
  })
  .strict()
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), 'No hay nada que cambiar.');

export const esquemaVariables = z
  .object({
    variables: z
      .array(
        z.object({
          etiqueta: z.string().trim().regex(/^[A-Za-z0-9_.\-]{1,80}$/, 'La etiqueta debe ser un marcador de hasta 80 caracteres.'),
          campoOrigen: z.string().trim().min(1, 'Cada variable necesita un campo de origen.').max(80, 'El campo de origen no puede superar 80 caracteres.'),
          obligatoria: z.boolean().default(true),
        }),
      )
      .max(80, 'Una plantilla no puede tener más de 80 variables.'),
  })
  .strict();

export const esquemaOrigenes = z
  .object({
    origenes: z
      .array(z.enum(['INTERNO', 'EXTERNO']), { required_error: 'Indica los orígenes permitidos.' })
      .min(1, 'La plantilla debe admitir al menos un origen.')
      .max(2),
  })
  .strict();

export const esquemaGenerar = z
  .object({
    plantillaId: z.string({ required_error: 'La plantilla es obligatoria.' }).uuid('La plantilla no es válida.'),
    datos: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  })
  .strict();

export function validar(esquema, datos) {
  const resultado = esquema.safeParse(datos ?? {});
  if (!resultado.success) {
    throw reglaInvalida('Hay datos inválidos en la solicitud.', resultado.error.issues.map((i) => i.message));
  }
  return resultado.data;
}

/** HU-035: la plantilla se sube como DOCX; se exige extensión y tipo real declarado. */
export function validarDocx({ nombre, tipoMime, contenido }) {
  const nombreOriginal = nombreLimpio(nombre);
  if (!nombreOriginal) throw reglaInvalida('La plantilla necesita un nombre de archivo.');
  if (extensionDe(nombreOriginal) !== 'docx') throw reglaInvalida('La plantilla debe ser un archivo .docx.');
  const mime = String(tipoMime ?? '').split(';')[0].trim().toLowerCase();
  if (mime !== DOCX_MIME) throw reglaInvalida('El tipo del archivo no corresponde a un DOCX.');
  if (!contenido?.length) throw reglaInvalida('El archivo de la plantilla está vacío.');
  if (contenido.length > TAMANIO_MAXIMO) {
    throw reglaInvalida(`La plantilla supera el máximo de ${TAMANIO_MAXIMO / (1024 * 1024)} MB.`);
  }
  return { nombreOriginal, tipoMime: mime };
}
