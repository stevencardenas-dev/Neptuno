import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../autenticacion';
import { conflicto, datosInvalidos, noEncontrado } from '../errores';
import { detallesDe, esquemaCrear, esquemaEditar, esquemaFiltros, Flujo, NuevoFlujo } from './modelo';
import { RepositorioFlujos } from './repositorio';

const DUPLICADO = 1062;

/**
 * Reglas del diseñador de flujos (HU-048…HU-051). El flujo nace en BORRADOR: la definición
 * de estados y transiciones vive en sus versiones y solo una versión publicada lo activa
 * (HU-061), por eso aquí todavía no se cambia el estado.
 */
@Injectable()
export class ServicioFlujos {
  constructor(private readonly repo: RepositorioFlujos) {}

  /** HU-049: buscar flujos por texto y estado, en páginas. */
  async listar(consulta: Record<string, unknown>) {
    const analisis = esquemaFiltros.safeParse(consulta);
    if (!analisis.success) throw datosInvalidos('Revisa los filtros de búsqueda.', detallesDe(analisis.error));
    const filtros = analisis.data;
    const [contenido, total] = await Promise.all([this.repo.listar(filtros), this.repo.contar(filtros)]);
    return { contenido, total, pagina: filtros.pagina, tamanio: filtros.tamanio };
  }

  /** HU-049: consultar un flujo concreto. */
  async consultar(id: string): Promise<Flujo> {
    const flujo = await this.repo.obtener(id);
    if (!flujo) throw noEncontrado('No existe un flujo con ese identificador.');
    return flujo;
  }

  /** HU-048: crear un flujo en borrador. El nombre es único entre flujos. */
  async crear(cuerpo: unknown, actor: Actor): Promise<Flujo> {
    const datos = this.validar<NuevoFlujo>(cuerpo, esquemaCrear);
    if (await this.repo.existeNombre(datos.nombre)) {
      throw conflicto(`Ya existe un flujo llamado "${datos.nombre}".`);
    }
    try {
      return await this.repo.crear(datos, autor(actor));
    } catch (error: any) {
      if (error?.errno === DUPLICADO) throw conflicto(`Ya existe un flujo llamado "${datos.nombre}".`);
      throw error;
    }
  }

  /** HU-051: corregir el nombre o la descripción sin tocar la definición ni las versiones. */
  async editar(id: string, cuerpo: unknown, actor: Actor): Promise<Flujo> {
    const actual = await this.consultar(id);
    const analisis = esquemaEditar.safeParse(cuerpo ?? {});
    if (!analisis.success) throw datosInvalidos('No se pudo editar el flujo.', detallesDe(analisis.error));

    const datos: NuevoFlujo = {
      nombre: analisis.data.nombre ?? actual.nombre,
      descripcion: analisis.data.descripcion === undefined ? actual.descripcion : (analisis.data.descripcion ?? null),
    };
    const cambios: string[] = [];
    if (datos.nombre !== actual.nombre) cambios.push('nombre');
    if (datos.descripcion !== actual.descripcion) cambios.push('descripcion');
    if (!cambios.length) return actual;

    if (cambios.includes('nombre') && (await this.repo.existeNombre(datos.nombre, id))) {
      throw conflicto(`Ya existe un flujo llamado "${datos.nombre}".`);
    }
    try {
      return await this.repo.actualizar(id, datos, autor(actor), cambios);
    } catch (error: any) {
      if (error?.errno === DUPLICADO) throw conflicto(`Ya existe un flujo llamado "${datos.nombre}".`);
      throw error;
    }
  }

  private validar<T>(cuerpo: unknown, esquema: { safeParse: (v: unknown) => any }): T {
    const analisis = esquema.safeParse(cuerpo ?? {});
    if (!analisis.success) {
      throw datosInvalidos('Hay datos inválidos en la solicitud.', detallesDe(analisis.error));
    }
    return analisis.data as T;
  }
}

/** Deja en el evento solo lo que la bitácora necesita del actor. */
function autor(actor: Actor) {
  return { id: actor?.id ?? null, correo: actor?.correo ?? null };
}
