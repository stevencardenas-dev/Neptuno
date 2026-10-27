import { z } from 'zod';
import type { Accion, TipoSujeto } from '../disenador/modelo';

/**
 * Bandeja de entrada (HU-062…HU-074).
 *
 * Un trámite es la ejecución de una versión publicada sobre un radicado. En cada paso
 * hay una tarea pendiente; el responsable del paso (usuario, rol, área o grupo) la ve en
 * su bandeja, la toma en exclusiva y ejecuta una de las transiciones definidas.
 */

export const ACCIONES_TAREA = ['APROBAR', 'DEVOLVER', 'CANCELAR', 'ENVIAR'] as const;
export type AccionTarea = (typeof ACCIONES_TAREA)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identificador = (campo: string) =>
  z.string({ required_error: `${campo} es obligatorio.` }).refine((valor) => UUID.test(valor), `${campo} no es válido.`);

/** HU-062: enviar un radicado a un flujo publicado. */
export const esquemaIniciar = z.object({
  radicadoId: identificador('El radicado'),
  flujoId: identificador('El flujo'),
});

/** HU-066…HU-068: la acción y su observación. Devolver y cancelar la exigen. */
export const esquemaEjecutar = z
  .object({
    accion: z.enum(ACCIONES_TAREA, {
      required_error: 'La acción es obligatoria.',
      invalid_type_error: 'La acción debe ser Aprobar, Devolver, Cancelar o Enviar.',
    }),
    observacion: z
      .string({ invalid_type_error: 'La observación debe ser texto.' })
      .trim()
      .max(2000, 'La observación no puede superar 2000 caracteres.')
      .nullish(),
  })
  .strict()
  .refine((datos) => !['DEVOLVER', 'CANCELAR'].includes(datos.accion) || (datos.observacion ?? '').length >= 3, {
    message: 'Devolver o cancelar exige una observación de al menos 3 caracteres.',
    path: ['observacion'],
  });

export type IniciarTramite = z.infer<typeof esquemaIniciar>;
export type EjecutarTarea = z.infer<typeof esquemaEjecutar>;

/** Un responsable del paso, tal como lo guardó el diseñador. */
export interface ResponsablePaso {
  tipoSujeto: TipoSujeto;
  sujetoId: string;
}

/** Una acción que se puede ejecutar desde el paso actual. */
export interface AccionDisponible {
  transicionId: string;
  accion: Accion;
  etiqueta: string;
  destinoId: string;
  destinoNombre: string;
}

/** Fila de la bandeja de entrada. */
export interface TareaBandeja {
  id: string;
  tramiteId: string;
  radicadoId: string;
  radicadoCodigo: string;
  radicadoAsunto: string;
  flujoId: string;
  flujoNombre: string;
  paso: { id: string; nombre: string; tipo: string };
  estado: 'PENDIENTE' | 'TOMADA';
  asignadaA: string | null;
  tomadaEn: Date | null;
  creadaEn: Date;
  venceEn: Date | null;
  vencida: boolean;
  esMia: boolean;
  /** El actor no es responsable del paso pero administra flujos (supervisión). */
  supervision: boolean;
  responsables: ResponsablePaso[];
  acciones: AccionDisponible[];
}

export interface MovimientoTramite {
  id: string;
  accion: string;
  observacion: string | null;
  usuarioId: string;
  usuarioCorreo: string | null;
  ocurridoEn: Date;
  origen: string | null;
  destino: string;
}

export interface TramiteDetalle {
  id: string;
  radicadoId: string;
  radicadoCodigo: string;
  radicadoAsunto: string;
  flujoId: string;
  flujoNombre: string;
  estado: string;
  iniciadoEn: Date;
  venceEn: Date | null;
  finalizadoEn: Date | null;
  pasoActual: { id: string; nombre: string; tipo: string };
  tareaAbierta: TareaBandeja | null;
  movimientos: MovimientoTramite[];
}

/** ¿El actor atiende este paso? Sin responsables, el paso es de bolsa común. */
export function esResponsable(
  actor: { id: string; areaId?: string; rolesIds: string[] },
  responsables: ResponsablePaso[],
): boolean {
  if (!responsables.length) return true;
  return responsables.some((responsable) => {
    if (responsable.tipoSujeto === 'USUARIO') return responsable.sujetoId === actor.id;
    if (responsable.tipoSujeto === 'AREA') return responsable.sujetoId === actor.areaId;
    if (responsable.tipoSujeto === 'ROL') return actor.rolesIds.includes(responsable.sujetoId);
    return false;
  });
}
