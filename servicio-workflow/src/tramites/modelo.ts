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

/** HU-074: el semáforo se calcula al consultar, nunca se guarda. */
export const SEMAFOROS = ['VERDE', 'AMBAR', 'ROJO', 'SIN_PLAZO'] as const;
export type Semaforo = (typeof SEMAFOROS)[number];

/** Ventana de aviso previo: un día antes del vencimiento el semáforo pasa a ámbar. */
const AVISO_MS = 24 * 60 * 60 * 1000;

export function semaforoDe(venceEn: Date | string | null | undefined, ahora = new Date()): Semaforo {
  if (!venceEn) return 'SIN_PLAZO';
  const restante = new Date(venceEn).getTime() - ahora.getTime();
  if (restante < 0) return 'ROJO';
  return restante <= AVISO_MS ? 'AMBAR' : 'VERDE';
}

/** HU-064: filtros y orden de la bandeja. Los vacíos del formulario no filtran. */
const opcional = <T extends z.ZodTypeAny>(esquema: T) =>
  z.preprocess((valor) => (valor === '' || valor === null ? undefined : valor), esquema.optional());

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD.');

export const esquemaFiltrosBandeja = z.object({
  desde: opcional(fecha),
  hasta: opcional(fecha),
  tipoDocumentalId: opcional(z.string().uuid('El tipo documental no es válido.')),
  origen: opcional(z.enum(['INTERNO', 'EXTERNO', 'RECIBIDO'])),
  vencidas: z.preprocess((valor) => valor === true || valor === 'true', z.boolean()).default(false),
  orden: z.preprocess(
    (valor) => (valor === '' || valor === null ? undefined : valor),
    z.enum(['VENCIMIENTO', 'RECIENTES', 'ANTIGUOS']).default('VENCIMIENTO'),
  ),
});

export type FiltrosBandeja = z.infer<typeof esquemaFiltrosBandeja>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identificador = (campo: string) =>
  z.string({ required_error: `${campo} es obligatorio.` }).refine((valor) => UUID.test(valor), `${campo} no es válido.`);

/** Los tipos documentales que atiende un flujo. Lista vacía = el flujo no se ofrece al radicar. */
export const esquemaTiposDocumentales = z.object({
  tipoDocumentalIds: z
    .array(identificador('El tipo documental'), { required_error: 'Indica los tipos documentales.' })
    .max(50, 'Un flujo no puede atender más de 50 tipos documentales.'),
});

/**
 * HU-062: enviar un radicado a un flujo publicado. Lo usan la pantalla de radicación y
 * servicio-documentos al radicar con flujo; este último envía además `radicadoCodigo` y
 * `tipoDocumentalId`, que se aceptan y se descartan: la fuente de verdad es el radicado
 * que el workflow lee de servicio-documentos por la API interna.
 */
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

/** HU-075, HU-077: firma electrónica de una tarea. */
export const esquemaFirmar = z
  .object({
    nombre: z
      .string({ invalid_type_error: 'El nombre del firmante debe ser texto.' })
      .trim()
      .max(120, 'El nombre no puede superar 120 caracteres.')
      .nullish(),
    /** SHA-256 del archivo firmado; si no llega, se sella la identidad del trámite. */
    hashDocumento: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, 'La huella debe ser un SHA-256 en hexadecimal.')
      .nullish(),
    metodo: z.enum(['ELECTRONICA', 'DIGITAL']).default('ELECTRONICA'),
  })
  .strict();

export type FirmarTarea = z.infer<typeof esquemaFirmar>;

/** Flujo entre los que puede elegir quien radica un documento de ese tipo. */
export interface FlujoDisponible {
  id: string;
  nombre: string;
  descripcion: string | null;
  versionId: string;
}
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
  /** HU-064: datos copiados al abrir el trámite para filtrar la bandeja. */
  tipoDocumentalId: string | null;
  origen: string | null;
  paso: { id: string; nombre: string; tipo: string };
  estado: 'PENDIENTE' | 'TOMADA';
  asignadaA: string | null;
  tomadaEn: Date | null;
  creadaEn: Date;
  venceEn: Date | null;
  vencida: boolean;
  /** HU-074: verde, ámbar, rojo o sin plazo. */
  semaforo: Semaforo;
  /** HU-076: el paso exige firma antes de avanzar. */
  requiereFirma: boolean;
  /** La firma de quien consulta ya está puesta en esta tarea. */
  firmada: boolean;
  esMia: boolean;
  /** El actor no es responsable del paso pero administra flujos (supervisión). */
  supervision: boolean;
  responsables: ResponsablePaso[];
  acciones: AccionDisponible[];
}

/** HU-077: una firma aplicada, tal como se consulta. */
export interface Firma {
  id: string;
  tramiteId: string;
  tareaId: string;
  estadoFlujoId: string;
  firmanteId: string;
  firmanteNombre: string;
  hashDocumento: string;
  metodo: string;
  ipOrigen: string | null;
  firmadoEn: Date;
}

/** HU-065: metadatos del radicado y sus anexos, dentro del detalle del trámite. */
export interface DocumentoResumen {
  id: string;
  codigo: string;
  asunto: string;
  estado: string;
  tipoDocumentalId: string;
  origen: string;
  areaId: string;
  radicadoPor: string;
}

export interface AnexoResumen {
  id: string;
  nombreOriginal: string;
  extension: string;
  tipoMime: string;
  tamanoBytes: number;
  procedencia: string;
  cargadoEn: Date | string;
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
  /** Versión del flujo con la que nació el trámite (HU-079). */
  versionId: string;
  tipoDocumentalId: string | null;
  origen: string | null;
  semaforo: Semaforo;
  /** HU-065: metadatos y anexos leídos de ms-document-management. */
  documento: DocumentoResumen | null;
  anexos: AnexoResumen[];
  /** HU-077: firmas aplicadas al trámite. */
  firmas: Firma[];
  /** Paso actual: `estadoActualId` y `estadoActual` repiten `pasoActual` para los clientes previos. */
  estadoActualId: string;
  estadoActual: string;
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
  grupos: string[] = [],
): boolean {
  if (!responsables.length) return true;
  return responsables.some((responsable) => {
    if (responsable.tipoSujeto === 'USUARIO') return responsable.sujetoId === actor.id;
    if (responsable.tipoSujeto === 'AREA') return responsable.sujetoId === actor.areaId;
    if (responsable.tipoSujeto === 'ROL') return actor.rolesIds.includes(responsable.sujetoId);
    if (responsable.tipoSujeto === 'GRUPO') return grupos.includes(responsable.sujetoId);
    return false;
  });
}
