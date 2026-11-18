import { jwtVerify } from 'jose';
import { timingSafeEqual } from 'node:crypto';
import { noAutenticado, prohibido } from './errores.js';

// Valida el JWT de acceso emitido por servicio-usuarios (HS256, mismo secreto) y deja
// al actor en req.actor. Los permisos viajan en el token, así que no hay llamada de red.
// Limitación conocida: no consulta la lista de tokens revocados de servicio-usuarios;
// un token cerrado con logout sigue valiendo aquí hasta que expire (30 min por defecto).
export function autenticar({ secreto, emisor }) {
  const llave = new TextEncoder().encode(secreto);
  return async (req, _res, next) => {
    try {
      const cabecera = req.get('authorization') ?? '';
      if (!cabecera.startsWith('Bearer ')) throw noAutenticado('Falta el token de acceso.');
      const token = cabecera.slice(7);
      const { payload } = await jwtVerify(token, llave, { issuer: emisor, algorithms: ['HS256'] });
      if (payload.typ !== 'ACCESO') throw noAutenticado('El token no es de acceso.');
      req.actor = {
        id: payload.sub,
        correo: payload.correo,
        areaId: payload.areaId,
        area: payload.area ?? null,
        roles: payload.roles ?? [],
        rolesIds: payload.rolesIds ?? [],
        permisos: new Set(payload.permisos ?? []),
        token,
      };
      next();
    } catch (error) {
      next(error.estado ? error : noAutenticado('El token de acceso no es válido o ya expiró.'));
    }
  };
}

export const requierePermiso = (...codigos) => (req, _res, next) =>
  codigos.some((codigo) => req.actor.permisos.has(codigo))
    ? next()
    : next(prohibido(`Requiere el permiso ${codigos.join(' o ')}.`));

/**
 * Autoriza las llamadas entre microservicios con la cabecera `X-Servicio-Clave`.
 * La comparación es en tiempo constante para no filtrar la clave carácter a carácter.
 */
export function exigirClaveServicios(clave) {
  const esperada = Buffer.from(clave);
  return (req, _res, next) => {
    const recibida = Buffer.from(req.get('x-servicio-clave') ?? '');
    const igual = recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
    next(igual ? undefined : prohibido('La clave de servicio no es válida.'));
  };
}
