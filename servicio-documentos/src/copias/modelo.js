import { z } from 'zod';
import { reglaInvalida } from '../errores.js';

/** HU-041, HU-042: copias informativas a otros usuarios y su bandeja secundaria. */
export const esquemaCopia = z
  .object({
    destinatarioId: z.string({ required_error: 'El destinatario es obligatorio.' }).uuid('El destinatario no es válido.'),
    mensaje: z.string().trim().max(500, 'El mensaje no puede superar 500 caracteres.').nullish(),
  })
  .strict();

export function validar(esquema, datos) {
  const resultado = esquema.safeParse(datos ?? {});
  if (!resultado.success) {
    throw reglaInvalida('Hay datos inválidos en la solicitud.', resultado.error.issues.map((i) => i.message));
  }
  return resultado.data;
}
