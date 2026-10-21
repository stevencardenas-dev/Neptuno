import { z } from 'zod';

export const ESTADOS = ['BORRADOR', 'ACTIVO', 'INACTIVO'] as const;
export type EstadoFlujo = (typeof ESTADOS)[number];

const nombre = z
  .string({ required_error: 'El nombre es obligatorio.', invalid_type_error: 'El nombre debe ser texto.' })
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres.')
  .max(120, 'El nombre no puede superar 120 caracteres.');

const descripcion = z
  .string({ invalid_type_error: 'La descripción debe ser texto.' })
  .trim()
  .max(500, 'La descripción no puede superar 500 caracteres.')
  .nullish();

// HU-048: crear flujo. HU-049: editar nombre y descripción de un flujo en borrador.
export const esquemaCrear = z.object({ nombre, descripcion });
export const esquemaEditar = z.object({ nombre: nombre.optional(), descripcion });

// Los filtros vacíos llegan como texto vacío (el «todos los estados» del desplegable);
// aquí se traducen a ausencia de filtro, que es lo que en realidad representan.
const opcional = <T extends z.ZodTypeAny>(esquema: T) =>
  z.preprocess((valor) => (valor === '' ? undefined : valor), esquema.optional());

export const esquemaFiltros = z.object({
  q: opcional(z.string().trim().max(120, 'La búsqueda no puede superar 120 caracteres.')),
  estado: opcional(z.enum(ESTADOS)),
  pagina: z.coerce.number().int().min(0).default(0),
  tamanio: z.coerce.number().int().min(1).max(100).default(20),
});

export type FiltrosFlujo = z.infer<typeof esquemaFiltros>;

/** Un flujo tal como lo ve el frontend. */
export interface Flujo {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: EstadoFlujo;
  versionActivaId: string | null;
  versiones: number;
  creadoEn: string;
  actualizadoEn: string | null;
}

export interface NuevoFlujo {
  nombre: string;
  descripcion: string | null;
}

/** Traduce los errores de zod al formato de detalles que ya muestra el frontend. */
export function detallesDe(error: z.ZodError): string[] {
  return error.issues.map((problema) =>
    problema.path.length ? `${problema.path.join('.')}: ${problema.message}` : problema.message,
  );
}
