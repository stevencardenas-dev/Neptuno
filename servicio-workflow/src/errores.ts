import { HttpException } from '@nestjs/common';

/**
 * Error con la misma forma que usan los otros servicios
 * (`{ codigo, mensaje, detalles }`), que es la que el frontend ya sabe mostrar.
 */
export class ErrorApi extends HttpException {
  constructor(estado: number, codigo: string, mensaje: string, detalles?: unknown) {
    super({ codigo, mensaje, ...(detalles === undefined ? {} : { detalles }) }, estado);
  }
}

export const datosInvalidos = (mensaje: string, detalles?: unknown) =>
  new ErrorApi(400, 'DATOS_INVALIDOS', mensaje, detalles);
export const noAutenticado = (mensaje: string) => new ErrorApi(401, 'NO_AUTENTICADO', mensaje);
export const prohibido = (mensaje: string) => new ErrorApi(403, 'PROHIBIDO', mensaje);
export const noEncontrado = (mensaje: string) => new ErrorApi(404, 'NO_ENCONTRADO', mensaje);
export const conflicto = (mensaje: string) => new ErrorApi(409, 'CONFLICTO', mensaje);
/** El flujo está bien formado pero le falta algo para publicarse (HU-061). */
export const noProcesable = (mensaje: string, detalles?: unknown) =>
  new ErrorApi(422, 'FLUJO_INCOMPLETO', mensaje, detalles);
