import { z } from 'zod';
import { reglaInvalida } from '../errores.js';

const texto = (campo, max) =>
  z.string({ required_error: `${campo} es obligatorio` }).trim().min(1, `${campo} es obligatorio`).max(max, `${campo} no puede superar ${max} caracteres`);

const fecha = z
  .string({ required_error: 'La fecha del documento es obligatoria' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v), 'La fecha no es válida');

const uuid = (campo) => z.string({ required_error: `${campo} es obligatorio` }).uuid(`${campo} no es válido`);

// HU-019 (obligatorios) y HU-039 (extendidos). El origen NO_RADICABLE no se radica aquí.
const campos = {
  tipoDocumentalId: uuid('El tipo documental'),
  areaId: uuid('El área').optional(),
  asunto: texto('El asunto', 300),
  remitente: texto('El remitente', 160),
  destinatario: texto('El destinatario', 160),
  fechaDocumento: fecha,
  folios: z.number().int('Los folios deben ser un entero').min(1, 'Los folios deben ser al menos 1').max(100000),
  entidadId: uuid('La entidad').nullable().optional(),
  comentarios: z.string().trim().max(2000, 'Los comentarios no pueden superar 2000 caracteres').nullable().optional(),
};

export const esquemaCrear = z
  .object({
    ...campos,
    origen: z.enum(['INTERNO', 'EXTERNO', 'RECIBIDO'], { errorMap: () => ({ message: 'El origen debe ser INTERNO, EXTERNO o RECIBIDO' }) }),
    clase: z.enum(['ORIGINAL', 'COPIA'], { errorMap: () => ({ message: 'La clase debe ser ORIGINAL o COPIA' }) }).default('ORIGINAL'),
    folios: campos.folios.default(1),
  })
  .strict();

// HU-021: el código y el origen no se editan; `version` protege contra ediciones simultáneas.
export const esquemaEditar = z
  .object({
    ...Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, k === 'entidadId' || k === 'comentarios' || k === 'areaId' ? v : v.optional()])),
    clase: z.enum(['ORIGINAL', 'COPIA']).optional(),
    version: z.number({ required_error: 'La versión es obligatoria' }).int().min(0),
  })
  .strict();

// HU-023
export const esquemaFiltros = z.object({
  codigo: z.string().trim().max(20).optional(),
  q: z.string().trim().max(100).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  origen: z.enum(['INTERNO', 'EXTERNO', 'RECIBIDO']).optional(),
  tipoDocumentalId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  estado: z.enum(['RADICADO', 'EN_TRAMITE', 'FINALIZADO', 'ANULADO']).optional(),
  pagina: z.coerce.number().int().min(0).default(0),
  tamanio: z.coerce.number().int().min(1).max(100).default(20),
});

export function validar(esquema, datos) {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((i) => (i.path.length ? i.message : `Cuerpo inválido: ${i.message}`));
    throw reglaInvalida('Hay datos inválidos en la solicitud.', detalles);
  }
  return resultado.data;
}
