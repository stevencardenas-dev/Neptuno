import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../autenticacion';
import { datosInvalidos, noEncontrado, noProcesable } from '../errores';
import { Catalogo } from '../disenador/catalogos';
import { esId } from '../disenador/modelo';
import { CATALOGOS } from '../disenador/servicio';
import { detallesDe } from '../flujos/modelo';
import { esquemaIniciar, esquemaTiposDocumentales, FlujoDisponible, Tramite } from './modelo';
import { RepositorioTramites } from './repositorio';

/**
 * Vínculo de los flujos con los tipos documentales y arranque de trámites desde la
 * radicación. Quien radica elige un flujo entre los que atienden el tipo de su documento;
 * el trámite nace en el paso inicial de la versión publicada.
 */
@Injectable()
export class ServicioTramites {
  constructor(
    private readonly repo: RepositorioTramites,
    @Inject(CATALOGOS) private readonly catalogos: Catalogo,
  ) {}

  async tiposDelFlujo(flujoId: string): Promise<{ tipoDocumentalIds: string[] }> {
    await this.exigirFlujo(flujoId);
    return { tipoDocumentalIds: await this.repo.tiposDelFlujo(flujoId) };
  }

  /** Reemplaza los tipos documentales del flujo. Cada tipo debe existir y estar activo. */
  async asignarTipos(flujoId: string, cuerpo: unknown, actor: Actor, token: string) {
    await this.exigirFlujo(flujoId);
    const analisis = esquemaTiposDocumentales.safeParse(cuerpo ?? {});
    if (!analisis.success) throw datosInvalidos('Hay datos inválidos en la solicitud.', detallesDe(analisis.error));
    const ids = [...new Set(analisis.data.tipoDocumentalIds)];
    for (const id of ids) {
      const tipo = await this.catalogos.tipoDocumental(id, token);
      if (!tipo) throw noEncontrado('Uno de los tipos documentales no existe.');
      if (tipo.estado !== 'ACTIVO') throw noProcesable(`El tipo documental "${tipo.nombre}" está inactivo.`);
    }
    await this.repo.reemplazarTipos(flujoId, ids, autor(actor));
    return { tipoDocumentalIds: ids };
  }

  async disponibles(tipoDocumentalId: unknown): Promise<FlujoDisponible[]> {
    if (typeof tipoDocumentalId !== 'string' || !esId(tipoDocumentalId)) {
      throw datosInvalidos('Indica el tipo documental del documento.');
    }
    return this.repo.disponibles(tipoDocumentalId);
  }

  /** El flujo elegido debe estar activo y atender el tipo documental del radicado. */
  async iniciar(cuerpo: unknown, actor: Actor): Promise<Tramite> {
    const analisis = esquemaIniciar.safeParse(cuerpo ?? {});
    if (!analisis.success) throw datosInvalidos('No se pudo iniciar el trámite.', detallesDe(analisis.error));
    const datos = analisis.data;
    const flujo = (await this.repo.disponibles(datos.tipoDocumentalId)).find((candidato) => candidato.id === datos.flujoId);
    if (!flujo) {
      throw noProcesable('Ese flujo no está activo o no atiende el tipo documental del radicado.');
    }
    return this.repo.iniciar(datos, flujo.versionId, autor(actor));
  }

  async porRadicado(radicadoId: unknown): Promise<Tramite> {
    if (typeof radicadoId !== 'string' || !esId(radicadoId)) throw noEncontrado('El radicado no tiene trámite.');
    const tramite = await this.repo.porRadicado(radicadoId);
    if (!tramite) throw noEncontrado('El radicado no tiene trámite.');
    return tramite;
  }

  private async exigirFlujo(id: string): Promise<void> {
    if (!esId(id) || !(await this.repo.existeFlujo(id))) throw noEncontrado('No existe un flujo con ese identificador.');
  }
}

function autor(actor: Actor) {
  return { id: actor?.id ?? null, correo: actor?.correo ?? null };
}
