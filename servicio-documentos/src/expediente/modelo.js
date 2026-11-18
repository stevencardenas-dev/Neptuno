import { z } from 'zod';
import { reglaInvalida } from '../errores.js';

/**
 * Modelo del expediente (HU-030…HU-034). Cada área tiene una carpeta raíz y puede
 * colgar subcarpetas temáticas; los documentos No radicables y los radicados se
 * archivan en cualquiera de ellas.
 */

const uuid = (campo) => z.string({ required_error: `${campo} es obligatorio.` }).uuid(`${campo} no es válido.`);

const nombre = z
  .string({ required_error: 'El nombre de la carpeta es obligatorio.' })
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres.')
  .max(120, 'El nombre no puede superar 120 caracteres.');

export const esquemaCarpeta = z
  .object({
    nombre,
    areaId: uuid('El área').optional(),
    padreId: uuid('La carpeta padre').nullish(),
    tipoExpediente: z.string().trim().max(80, 'El tipo de expediente no puede superar 80 caracteres.').nullish(),
  })
  .strict();

export const esquemaCarpetaEditar = z
  .object({
    nombre: nombre.optional(),
    tipoExpediente: z.string().trim().max(80, 'El tipo de expediente no puede superar 80 caracteres.').nullish(),
  })
  .strict()
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), 'No hay nada que cambiar.');

export const NIVELES = ['VER', 'CARGAR', 'ADMINISTRAR'];
const ORDEN_NIVEL = { VER: 1, CARGAR: 2, ADMINISTRAR: 3 };

export const esquemaAccesos = z
  .object({
    accesos: z
      .array(
        z.object({
          tipoSujeto: z.enum(['ROL', 'AREA'], { required_error: 'El sujeto debe ser un rol o un área.' }),
          sujetoId: uuid('El sujeto'),
          nivel: z.enum(NIVELES, { required_error: 'El nivel debe ser VER, CARGAR o ADMINISTRAR.' }),
        }),
      )
      .max(50, 'Una carpeta no puede tener más de 50 accesos.'),
  })
  .strict();

export const esquemaDocumento = z
  .object({
    titulo: z
      .string({ required_error: 'El título es obligatorio.' })
      .trim()
      .min(3, 'El título debe tener al menos 3 caracteres.')
      .max(200, 'El título no puede superar 200 caracteres.'),
    descripcion: z.string().trim().max(1000, 'La descripción no puede superar 1000 caracteres.').nullish(),
  })
  .strict();

export function validar(esquema, datos) {
  const resultado = esquema.safeParse(datos ?? {});
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((i) => i.message);
    throw reglaInvalida('Hay datos inválidos en la solicitud.', detalles);
  }
  return resultado.data;
}

/** ¿El nivel `tiene` alcanza para el nivel `exige`? */
export function alcanza(tiene, exige) {
  return (ORDEN_NIVEL[tiene] ?? 0) >= (ORDEN_NIVEL[exige] ?? 0);
}

/** El nivel más alto entre varios (null si no hay ninguno). */
export function mayorNivel(niveles) {
  return niveles.filter(Boolean).sort((a, b) => ORDEN_NIVEL[b] - ORDEN_NIVEL[a])[0] ?? null;
}
