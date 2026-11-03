import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../autenticacion';
import { Catalogo } from '../disenador/catalogos';
import { CATALOGOS } from '../disenador/servicio';
import { conflicto, datosInvalidos, noEncontrado } from '../errores';
import { detallesDe } from '../flujos/modelo';
import { esquemaGrupo, esquemaGrupoEditar, esquemaMiembros, Grupo, GrupoNuevo } from './modelo';
import { RepositorioGrupos } from './repositorio';

function autor(actor: Actor) {
  return { id: actor?.id ?? null, correo: actor?.correo ?? null };
}

/**
 * Grupos de trabajo (HU-069): un conjunto de usuarios que atiende un paso en conjunto.
 * Los miembros se validan contra ms-auth-catalogs antes de guardarlos.
 */
@Injectable()
export class ServicioGrupos {
  constructor(
    private readonly repo: RepositorioGrupos,
    @Inject(CATALOGOS) private readonly catalogos: Catalogo,
  ) {}

  listar(): Promise<Grupo[]> {
    return this.repo.listar();
  }

  async obtener(id: string): Promise<Grupo> {
    const grupo = await this.repo.obtener(id);
    if (!grupo) throw noEncontrado('El grupo no existe.');
    return grupo;
  }

  async crear(cuerpo: unknown, actor: Actor, token: string): Promise<Grupo> {
    const datos = this.validar<GrupoNuevo>(cuerpo, esquemaGrupo);
    const miembros = [...new Set(datos.miembros)];
    await this.validarMiembros(miembros, token);
    if (await this.repo.existeNombre(datos.nombre)) {
      throw conflicto(`Ya existe un grupo llamado «${datos.nombre}».`);
    }
    return this.repo.crear({ nombre: datos.nombre, descripcion: datos.descripcion ?? null, miembros }, autor(actor));
  }

  async editar(id: string, cuerpo: unknown, actor: Actor): Promise<Grupo> {
    const actual = await this.obtener(id);
    const analisis = esquemaGrupoEditar.safeParse(cuerpo ?? {});
    if (!analisis.success) throw datosInvalidos('No se pudo editar el grupo.', detallesDe(analisis.error));
    const nombre = analisis.data.nombre ?? actual.nombre;
    if (nombre !== actual.nombre && (await this.repo.existeNombre(nombre, id))) {
      throw conflicto(`Ya existe un grupo llamado «${nombre}».`);
    }
    return this.repo.actualizar(id, {
      nombre,
      descripcion: analisis.data.descripcion === undefined ? actual.descripcion : analisis.data.descripcion,
    }, autor(actor));
  }

  async reemplazarMiembros(id: string, cuerpo: unknown, actor: Actor, token: string): Promise<Grupo> {
    await this.obtener(id);
    const { usuarios } = this.validar<{ usuarios: string[] }>(cuerpo, esquemaMiembros);
    const miembros = [...new Set(usuarios)];
    await this.validarMiembros(miembros, token);
    await this.repo.reemplazarMiembros(id, miembros, autor(actor));
    return this.obtener(id);
  }

  async eliminar(id: string, actor: Actor): Promise<void> {
    await this.obtener(id);
    await this.repo.eliminar(id, autor(actor));
  }

  private async validarMiembros(usuarios: string[], token: string): Promise<void> {
    const faltantes: string[] = [];
    for (const usuarioId of usuarios) {
      if (!(await this.catalogos.usuario(usuarioId, token))) faltantes.push(usuarioId);
    }
    if (faltantes.length) {
      throw datosInvalidos('Hay usuarios que no existen o están inactivos.', faltantes);
    }
  }

  private validar<T>(cuerpo: unknown, esquema: { safeParse: (v: unknown) => any }): T {
    const analisis = esquema.safeParse(cuerpo ?? {});
    if (!analisis.success) throw datosInvalidos('Hay datos inválidos en la solicitud.', detallesDe(analisis.error));
    return analisis.data as T;
  }
}
