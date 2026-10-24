import { z } from 'zod';
import { esId } from '../disenador/modelo';

const id = (campo: string) =>
  z
    .string({ required_error: `${campo} es obligatorio.`, invalid_type_error: `${campo} no es válido.` })
    .refine(esId, `${campo} no es válido.`);

/** Los tipos documentales que atiende un flujo. Lista vacía = el flujo no se ofrece al radicar. */
export const esquemaTiposDocumentales = z.object({
  tipoDocumentalIds: z
    .array(id('El tipo documental'), { required_error: 'Indica los tipos documentales.' })
    .max(50, 'Un flujo no puede atender más de 50 tipos documentales.'),
});

/** Lo que envía ms-document-management al radicar un documento con flujo. */
export const esquemaIniciar = z.object({
  radicadoId: id('El radicado'),
  radicadoCodigo: z
    .string({ required_error: 'El código del radicado es obligatorio.' })
    .trim()
    .min(1, 'El código del radicado es obligatorio.')
    .max(40, 'El código del radicado no puede superar 40 caracteres.'),
  flujoId: id('El flujo'),
  tipoDocumentalId: id('El tipo documental'),
});
export type IniciarTramite = z.infer<typeof esquemaIniciar>;

export interface FlujoDisponible {
  id: string;
  nombre: string;
  descripcion: string | null;
  versionId: string;
}

export interface Tramite {
  id: string;
  radicadoId: string;
  radicadoCodigo: string;
  flujoId: string;
  flujoNombre: string;
  versionId: string;
  estadoActualId: string;
  estadoActual: string;
  estado: 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO';
  iniciadoEn: string;
}
