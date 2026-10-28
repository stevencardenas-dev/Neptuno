import { z } from 'zod';

/**
 * Modelo del diseñador de flujos (HU-050 y HU-052…HU-061).
 *
 * La definición vive en una versión del flujo (`flujo_version`) y no en el flujo: así los
 * trámites que ya empezaron siguen con la definición con la que nacieron. Mientras la
 * versión está en borrador se puede editar; una vez publicada queda bloqueada.
 */

export const TIPOS_ESTADO = ['INICIAL', 'INTERMEDIO', 'FINAL'] as const;
export type TipoEstado = (typeof TIPOS_ESTADO)[number];

/** Acciones que el responsable de un paso puede ejecutar (base de HU-066…HU-068). */
export const ACCIONES = ['APROBAR', 'DEVOLVER', 'CANCELAR', 'ENVIAR'] as const;
export type Accion = (typeof ACCIONES)[number];

export const TIPOS_SUJETO = ['USUARIO', 'GRUPO', 'ROL', 'AREA'] as const;
export type TipoSujeto = (typeof TIPOS_SUJETO)[number];

/** Un identificador que llega por la ruta: si no es un UUID no vale la pena ir a la base. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esId = (valor: string): boolean => UUID.test(valor);

const identificador = (campo: string) =>
  z.string({ required_error: `${campo} es obligatorio.`, invalid_type_error: `${campo} debe ser texto.` })
    .refine((valor) => esId(valor), `${campo} no es un identificador válido.`);

const nombrePaso = z
  .string({ required_error: 'El nombre del paso es obligatorio.', invalid_type_error: 'El nombre del paso debe ser texto.' })
  .trim()
  .min(2, 'El nombre del paso debe tener al menos 2 caracteres.')
  .max(80, 'El nombre del paso no puede superar 80 caracteres.');

const descripcionPaso = z
  .string({ invalid_type_error: 'La descripción debe ser texto.' })
  .trim()
  .max(500, 'La descripción no puede superar 500 caracteres.')
  .nullish();

/** Posición del paso en el lienzo (HU-052): se guarda para que el dibujo no cambie. */
const posicion = z.coerce
  .number({ invalid_type_error: 'La posición debe ser un número.' })
  .int('La posición debe ser un número entero.')
  .min(0, 'La posición no puede ser negativa.')
  .max(20000, 'La posición está fuera del lienzo.');

// HU-053: agregar un paso al flujo. El tipo va aparte (HU-055) pero se admite al crearlo
// porque el lienzo marca el paso inicial en el mismo gesto.
export const esquemaPasoCrear = z.object({
  nombre: nombrePaso,
  descripcion: descripcionPaso,
  tipo: z.enum(TIPOS_ESTADO).default('INTERMEDIO'),
  posicionX: posicion.optional(),
  posicionY: posicion.optional(),
});

// HU-054: corregir el nombre o la descripción del paso y recordar dónde quedó en el lienzo.
export const esquemaPasoEditar = z
  .object({
    nombre: nombrePaso.optional(),
    descripcion: descripcionPaso,
    posicionX: posicion.optional(),
    posicionY: posicion.optional(),
  })
  .refine(
    (datos) => Object.values(datos).some((valor) => valor !== undefined),
    'No hay nada que cambiar en el paso.',
  );

// HU-055: el paso pasa a ser inicial, intermedio o final.
export const esquemaPasoTipo = z.object({
  tipo: z.enum(TIPOS_ESTADO, {
    required_error: 'El tipo del paso es obligatorio.',
    invalid_type_error: 'El tipo del paso debe ser Inicial, Intermedio o Final.',
  }),
});

// HU-056: una transición es la acción que lleva de un paso a otro.
export const esquemaTransicionCrear = z
  .object({
    estadoOrigenId: identificador('El paso de origen'),
    estadoDestinoId: identificador('El paso de destino'),
    accion: z.enum(ACCIONES, {
      required_error: 'La acción de la transición es obligatoria.',
      invalid_type_error: 'La acción debe ser Aprobar, Devolver, Cancelar o Enviar.',
    }),
    etiqueta: z
      .string({ invalid_type_error: 'La etiqueta debe ser texto.' })
      .trim()
      .max(80, 'La etiqueta no puede superar 80 caracteres.')
      .nullish(),
  })
  .refine((datos) => datos.estadoOrigenId !== datos.estadoDestinoId, {
    message: 'El paso de origen y el de destino deben ser distintos.',
    path: ['estadoDestinoId'],
  });

// HU-057: cambiar la acción, el destino o el texto de la transición.
export const esquemaTransicionEditar = z
  .object({
    estadoDestinoId: identificador('El paso de destino').optional(),
    accion: z.enum(ACCIONES).optional(),
    etiqueta: z
      .string({ invalid_type_error: 'La etiqueta debe ser texto.' })
      .trim()
      .max(80, 'La etiqueta no puede superar 80 caracteres.')
      .nullish(),
  })
  .refine(
    (datos) => Object.values(datos).some((valor) => valor !== undefined),
    'No hay nada que cambiar en la transición.',
  );

// HU-059: rol, área, usuario o grupo responsable de atender un paso.
export const esquemaResponsable = z.object({
  tipoSujeto: z.enum(TIPOS_SUJETO, {
    required_error: 'El tipo de responsable es obligatorio.',
    invalid_type_error: 'El responsable debe ser un usuario, un grupo, un rol o un área.',
  }),
  sujetoId: identificador('El responsable'),
});

export type PasoCrear = z.infer<typeof esquemaPasoCrear>;
export type PasoEditar = z.infer<typeof esquemaPasoEditar>;
export type TransicionCrear = z.infer<typeof esquemaTransicionCrear>;
export type TransicionEditar = z.infer<typeof esquemaTransicionEditar>;
export type ResponsableNuevo = z.infer<typeof esquemaResponsable>;

/** Un responsable tal como lo ve el lienzo (el nombre lo resuelve el frontend). */
export interface Responsable {
  id: string;
  tipoSujeto: TipoSujeto;
  sujetoId: string;
}

/** Un paso del flujo, con su sitio en el lienzo y quién lo atiende. */
export interface Paso {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoEstado;
  posicionX: number;
  posicionY: number;
  responsables: Responsable[];
}

/** HU-056…HU-058: la acción que lleva de un paso a otro. */
export interface Transicion {
  id: string;
  estadoOrigenId: string;
  estadoDestinoId: string;
  accion: Accion;
  etiqueta: string | null;
}

/** La versión sobre la que se está trabajando. */
export interface VersionDeTrabajo {
  id: string;
  numero: number;
  estado: string;
}

/** HU-080: una fila del historial de versiones de un flujo. */
export interface VersionResumen {
  id: string;
  numero: number;
  estado: string;
  /** Es la que usan los trámites nuevos. */
  vigente: boolean;
  pasos: number;
  creadoPor: string | null;
  creadoEn: string | null;
  publicadoPor: string | null;
  publicadoEn: string | null;
}

/** HU-052: todo lo que el lienzo necesita para dibujar el flujo de un vistazo. */
export interface Grafo {
  flujoId: string;
  flujo: string;
  estadoFlujo: string;
  version: VersionDeTrabajo | null;
  /** Número de la versión publicada que usan los trámites; distinta de `version` cuando se edita un borrador nuevo (HU-078). */
  versionEnOperacion: number | null;
  editable: boolean;
  pasos: Paso[];
  transiciones: Transicion[];
}
