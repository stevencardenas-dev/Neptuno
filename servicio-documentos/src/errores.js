// Errores de negocio, traducidos a HTTP por el manejador de app.js.
// El cuerpo replica el de servicio-usuarios: { codigo, mensaje, detalles, momento }.
export class ErrorApi extends Error {
  constructor(estado, codigo, mensaje, detalles = []) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export const noEncontrado = (m) => new ErrorApi(404, 'NO_ENCONTRADO', m);
export const conflicto = (m) => new ErrorApi(409, 'CONFLICTO', m);
export const reglaInvalida = (m, detalles) => new ErrorApi(400, 'REGLA_INVALIDA', m, detalles);
export const noAutenticado = (m) => new ErrorApi(401, 'NO_AUTENTICADO', m);
export const prohibido = (m) => new ErrorApi(403, 'ACCESO_DENEGADO', m);
