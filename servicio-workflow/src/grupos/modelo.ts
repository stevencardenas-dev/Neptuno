import { z } from 'zod';

/**
 * Grupos de trabajo (HU-069). Un paso puede asignarse a un grupo y cualquiera de sus
 * miembros lo atiende; sirve para equipos que se turnan una misma tarea.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identificador = (campo: string) =>
  z.string({ required_error: `${campo} es obligatorio.` }).refine((valor) => UUID.test(valor), `${campo} no es válido.`);

const nombre = z
  .string({ required_error: 'El nombre del grupo es obligatorio.' })
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres.')
  .max(120, 'El nombre no puede superar 120 caracteres.');

const descripcion = z
  .string({ invalid_type_error: 'La descripción debe ser texto.' })
  .trim()
  .max(300, 'La descripción no puede superar 300 caracteres.')
  .nullish();

export const esquemaGrupo = z.object({
  nombre,
  descripcion,
  miembros: z.array(identificador('El usuario'), { invalid_type_error: 'Los miembros deben ser una lista de usuarios.' })
    .max(200, 'Un grupo no puede tener más de 200 miembros.')
    .default([]),
});

export const esquemaGrupoEditar = z
  .object({ nombre: nombre.optional(), descripcion })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), 'No hay nada que cambiar en el grupo.');

export const esquemaMiembros = z.object({
  usuarios: z.array(identificador('El usuario'), { required_error: 'Indica los miembros del grupo.' })
    .max(200, 'Un grupo no puede tener más de 200 miembros.'),
});

export type GrupoNuevo = z.infer<typeof esquemaGrupo>;

export interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  miembros: string[];
  creadoEn: Date | string;
}
