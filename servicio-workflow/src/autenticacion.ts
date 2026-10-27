import { CanActivate, ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CONFIG, Config } from './config';
import { noAutenticado, prohibido } from './errores';
import { Inject } from '@nestjs/common';

// jose solo publica módulos ESM y este servicio compila a CommonJS: con `import()` normal
// TypeScript lo convertiría en un require() y fallaría. Esta indirección deja el import
// dinámico tal cual, una sola vez, la primera vez que se valida un token.
const importar = new Function('modulo', 'return import(modulo)') as (modulo: string) => Promise<any>;

export const PERMISO = 'permiso';
/** Marca un manejador con el permiso que exige, igual que `@PreAuthorize` en los otros servicios. */
export const RequierePermiso = (codigo: string) => SetMetadata(PERMISO, codigo);

export interface Actor {
  id: string;
  correo: string;
  areaId?: string;
  roles: string[];
  rolesIds: string[];
  permisos: Set<string>;
}

/** Deja el actor del token en el manejador que lo pida. */
export const ActorActual = createParamDecorator((_datos: unknown, contexto: ExecutionContext): Actor => {
  return contexto.switchToHttp().getRequest().actor;
});

/**
 * El token con el que llegó la petición. Se reenvía a los catálogos de servicio-usuarios
 * cuando hay que validar un dato contra ellos (HU-059), igual que hace servicio-documentos.
 */
export const TokenActual = createParamDecorator((_datos: unknown, contexto: ExecutionContext): string => {
  return contexto.switchToHttp().getRequest().token;
});

/**
 * Valida el JWT de acceso emitido por servicio-usuarios (HS256, mismo secreto) y comprueba
 * el permiso que exige el manejador. Los permisos viajan dentro del token, así que no hay
 * llamada de red. Limitación conocida y compartida con los demás servicios: no consulta la
 * lista de tokens revocados, así que un token cerrado con logout vale hasta que expire.
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  private jose?: any;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const peticion = contexto.switchToHttp().getRequest();
    const cabecera: string = peticion.headers?.authorization ?? '';
    if (!cabecera.startsWith('Bearer ')) throw noAutenticado('Falta el token de acceso.');

    const jose = (this.jose ??= await importar('jose'));
    let payload: any;
    try {
      ({ payload } = await jose.jwtVerify(cabecera.slice(7), new TextEncoder().encode(this.config.jwt.secreto), {
        issuer: this.config.jwt.emisor,
        algorithms: ['HS256'],
      }));
    } catch {
      throw noAutenticado('El token de acceso no es válido o ya expiró.');
    }
    if (payload.typ !== 'ACCESO') throw noAutenticado('El token no es de acceso.');

    peticion.token = cabecera.slice(7);
    peticion.actor = {
      id: payload.sub,
      correo: payload.correo,
      areaId: payload.areaId,
      roles: payload.roles ?? [],
      rolesIds: payload.rolesIds ?? [],
      permisos: new Set<string>(payload.permisos ?? []),
    } satisfies Actor;

    const permiso = this.reflector.getAllAndOverride<string>(PERMISO, [contexto.getHandler(), contexto.getClass()]);
    if (permiso && !peticion.actor.permisos.has(permiso)) throw prohibido(`Requiere el permiso ${permiso}.`);
    return true;
  }
}
