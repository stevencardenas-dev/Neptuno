import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../autenticacion';
import { conflicto, datosInvalidos, noEncontrado, noProcesable } from '../errores';
import { detallesDe } from '../flujos/modelo';
import { Catalogo } from './catalogos';
import {
  esId,
  esquemaPasoCrear,
  esquemaPasoEditar,
  esquemaPasoTipo,
  esquemaResponsable,
  esquemaTransicionCrear,
  esquemaTransicionEditar,
  Grafo,
  PasoCrear,
  PasoEditar,
  Responsable,
  TipoEstado,
  TransicionCrear,
  TransicionEditar,
} from './modelo';
import { RepositorioDisenador } from './repositorio';
import { validarPublicacion } from './validacion';

export const CATALOGOS = 'CATALOGOS';

/**
 * Reglas del diseñador de flujos (HU-050 y HU-052…HU-061). El servicio traduce el cuerpo
 * de la petición, consulta el catálogo de usuarios cuando hace falta y decide si el flujo
 * está en condiciones de publicarse; el repositorio se ocupa de la transacción.
 */
@Injectable()
export class ServicioDisenador {
  constructor(
    private readonly repo: RepositorioDisenador,
    @Inject(CATALOGOS) private readonly catalogos: Catalogo,
  ) {}

  /** HU-052: los pasos, las transiciones y el sitio de cada paso en el lienzo. */
  async grafo(id: string): Promise<Grafo> {
    this.exigirId(id);
    const grafo = await this.repo.grafo(id);
    if (!grafo) throw noEncontrado('No existe un flujo con ese identificador.');
    return grafo;
  }

  /** HU-053: agregar un paso. */
  async agregarPaso(id: string, cuerpo: unknown, actor: Actor): Promise<Grafo> {
    this.exigirId(id);
    const datos = this.validar<PasoCrear>(cuerpo, esquemaPasoCrear);
    await this.repo.agregarPaso(id, datos, autor(actor));
    return this.grafo(id);
  }

  /** HU-054: corregir un paso (nombre, descripción o sitio en el lienzo). */
  async editarPaso(id: string, pasoId: string, cuerpo: unknown, actor: Actor): Promise<Grafo> {
    this.exigirId(id, pasoId);
    const datos = this.validar<PasoEditar>(cuerpo, esquemaPasoEditar);
    await this.repo.editarPaso(id, pasoId, datos, autor(actor));
    return this.grafo(id);
  }

  /** HU-055: marcar el paso como inicial, intermedio o final. */
  async marcarPaso(id: string, pasoId: string, cuerpo: unknown, actor: Actor): Promise<Grafo> {
    this.exigirId(id, pasoId);
    const { tipo } = this.validar<{ tipo: TipoEstado }>(cuerpo, esquemaPasoTipo);
    await this.repo.marcarPaso(id, pasoId, tipo, autor(actor));
    return this.grafo(id);
  }

  /** HU-054: retirar un paso que se agregó por error o que ya no existe. */
  async retirarPaso(id: string, pasoId: string, actor: Actor): Promise<Grafo> {
    this.exigirId(id, pasoId);
    await this.repo.retirarPaso(id, pasoId, autor(actor));
    return this.grafo(id);
  }

  /** HU-056: crear una transición. */
  async agregarTransicion(id: string, cuerpo: unknown, actor: Actor): Promise<Grafo> {
    this.exigirId(id);
    const datos = this.validar<TransicionCrear>(cuerpo, esquemaTransicionCrear);
    await this.repo.agregarTransicion(id, datos, autor(actor));
    return this.grafo(id);
  }

  /** HU-057: editar una transición. */
  async editarTransicion(id: string, transicionId: string, cuerpo: unknown, actor: Actor): Promise<Grafo> {
    this.exigirId(id, transicionId);
    const datos = this.validar<TransicionEditar>(cuerpo, esquemaTransicionEditar);
    await this.repo.editarTransicion(id, transicionId, datos, autor(actor));
    return this.grafo(id);
  }

  /** HU-058: eliminar una transición. */
  async retirarTransicion(id: string, transicionId: string, actor: Actor): Promise<Grafo> {
    this.exigirId(id, transicionId);
    await this.repo.retirarTransicion(id, transicionId, autor(actor));
    return this.grafo(id);
  }

  /** HU-059: asignar un rol o un área a un paso, validándolos contra el catálogo. */
  async asignarResponsable(id: string, pasoId: string, cuerpo: unknown, actor: Actor, token: string): Promise<Grafo> {
    this.exigirId(id, pasoId);
    const datos = this.validar<{ tipoSujeto: Responsable['tipoSujeto']; sujetoId: string }>(cuerpo, esquemaResponsable);
    await this.verificarSujeto(datos.tipoSujeto, datos.sujetoId, token);
    await this.repo.asignarResponsable(id, pasoId, datos.tipoSujeto, datos.sujetoId, autor(actor));
    return this.grafo(id);
  }

  /** HU-060: quitar un responsable de un paso. */
  async quitarResponsable(id: string, pasoId: string, responsableId: string, actor: Actor): Promise<Grafo> {
    this.exigirId(id, pasoId, responsableId);
    await this.repo.quitarResponsable(id, pasoId, responsableId, autor(actor));
    return this.grafo(id);
  }

  /**
   * HU-061: publicar. Antes de tocar nada se revisa el flujo completo (paso inicial,
   * pasos finales y sin pasos aislados) y, si algo falta, se devuelven todos los
   * problemas juntos con un 422.
   */
  async publicar(id: string, actor: Actor): Promise<Grafo> {
    this.exigirId(id);
    const grafo = await this.grafo(id);
    if (!grafo.version) throw conflicto('El flujo no tiene pasos que publicar.');
    if (!grafo.editable) throw conflicto('Este flujo ya está publicado y en operación.');

    const problemas = validarPublicacion(grafo.pasos, grafo.transiciones);
    if (problemas.length) {
      throw noProcesable('El flujo todavía no está completo para publicarse.', problemas);
    }
    await this.repo.publicar(id, autor(actor));
    return this.grafo(id);
  }

  /** HU-050: archivar el flujo. */
  async desactivar(id: string, actor: Actor): Promise<Grafo> {
    this.exigirId(id);
    await this.repo.desactivar(id, autor(actor));
    return this.grafo(id);
  }

  /** HU-050: devolver el flujo a la operación. */
  async reactivar(id: string, actor: Actor): Promise<Grafo> {
    this.exigirId(id);
    await this.repo.reactivar(id, autor(actor));
    return this.grafo(id);
  }

  /**
   * HU-059: los roles y las áreas viven en ms-auth-catalogs, así que se comprueban allí
   * antes de guardar. Los usuarios y los grupos (HU-069) todavía no tienen catálogo.
   */
  private async verificarSujeto(tipo: Responsable['tipoSujeto'], sujetoId: string, token: string): Promise<void> {
    const consulta = tipo === 'ROL' ? this.catalogos.rol(sujetoId, token) : tipo === 'AREA' ? this.catalogos.area(sujetoId, token) : null;
    if (!consulta) return;
    const sujeto = await consulta;
    if (!sujeto) {
      throw noEncontrado(
        tipo === 'ROL' ? 'No existe ese rol en el sistema.' : 'No existe esa área en el sistema.',
      );
    }
  }

  /** Los identificadores llegan por la ruta: sin UUID no hay nada que buscar. */
  private exigirId(...ids: string[]): void {
    if (ids.some((id) => !esId(id))) throw noEncontrado('No existe un flujo con ese identificador.');
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
