import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../autenticacion';
import { conflicto, datosInvalidos, noEncontrado, noProcesable, prohibido } from '../errores';
import { Catalogo } from '../disenador/catalogos';
import { esId, type Accion } from '../disenador/modelo';
import { CATALOGOS } from '../disenador/servicio';
import { detallesDe } from '../flujos/modelo';
import { RepositorioTramites } from './repositorio';
import {
  esResponsable,
  esquemaEjecutar,
  esquemaIniciar,
  esquemaTiposDocumentales,
  EjecutarTarea,
  FlujoDisponible,
  IniciarTramite,
  TareaBandeja,
  TramiteDetalle,
} from './modelo';
import { ClienteDocumentos, DOCUMENTOS } from './documentos';

/**
 * Vínculo de los flujos con los tipos documentales y HU-062…HU-074: abrir un trámite
 * sobre un radicado, listar la bandeja por responsable, tomar una tarea y ejecutar la
 * acción del paso.
 *
 * La autorización no se queda en el permiso general: además de `flujo:aprobar`, el actor
 * tiene que ser responsable del paso (usuario, rol o área). Quien administra flujos ve
 * todas las bandejas en modo supervisión; es la única excepción, y queda marcada.
 */
@Injectable()
export class ServicioTramites {
  constructor(
    private readonly repo: RepositorioTramites,
    @Inject(DOCUMENTOS) private readonly documentos: ClienteDocumentos,
    @Inject(CATALOGOS) private readonly catalogos: Catalogo,
  ) {}

  async tiposDelFlujo(flujoId: string): Promise<{ tipoDocumentalIds: string[] }> {
    await this.exigirFlujo(flujoId);
    return { tipoDocumentalIds: await this.repo.tiposDelFlujo(flujoId) };
  }

  /** Reemplaza los tipos documentales del flujo. Cada tipo debe existir y estar activo. */
  async asignarTipos(flujoId: string, cuerpo: unknown, actor: Actor, token: string) {
    await this.exigirFlujo(flujoId);
    const { tipoDocumentalIds } = this.validar<{ tipoDocumentalIds: string[] }>(cuerpo, esquemaTiposDocumentales);
    const ids = [...new Set(tipoDocumentalIds)];
    for (const id of ids) {
      const tipo = await this.catalogos.tipoDocumental(id, token);
      if (!tipo) throw noEncontrado('Uno de los tipos documentales no existe.');
      if (tipo.estado !== 'ACTIVO') throw noProcesable(`El tipo documental "${tipo.nombre}" está inactivo.`);
    }
    await this.repo.reemplazarTipos(flujoId, ids, autor(actor));
    return { tipoDocumentalIds: ids };
  }

  /** Flujos entre los que puede elegir quien envía a un flujo un documento de ese tipo. */
  async disponibles(tipoDocumentalId: unknown): Promise<FlujoDisponible[]> {
    if (typeof tipoDocumentalId !== 'string' || !esId(tipoDocumentalId)) {
      throw datosInvalidos('Indica el tipo documental del documento.');
    }
    return this.repo.disponibles(tipoDocumentalId);
  }

  /**
   * HU-062: el radicado entra al flujo publicado y queda en el paso inicial. Llega desde
   * la pantalla de radicación o desde servicio-documentos al radicar con flujo; en los dos
   * casos el radicado se lee de servicio-documentos, que es su dueño.
   */
  async iniciar(cuerpo: unknown, actor: Actor): Promise<TramiteDetalle> {
    const datos = this.validar<IniciarTramite>(cuerpo, esquemaIniciar);
    const flujo = await this.repo.flujoActivo(datos.flujoId);
    if (!flujo) throw noProcesable('Ese flujo no está activo o no tiene una versión publicada.');
    const inicial = await this.repo.estadoInicial(flujo.versionId);
    if (!inicial) throw noProcesable('El flujo no tiene un paso inicial: no se puede iniciar el trámite.');

    const radicado = await this.documentos.radicado(datos.radicadoId);
    if (!radicado.tipoDocumentalId || !(await this.repo.atiendeTipo(flujo.id, radicado.tipoDocumentalId))) {
      throw noProcesable('Ese flujo no atiende el tipo documental del radicado.');
    }
    if (radicado.estado === 'ANULADO') throw conflicto('Un radicado anulado no se puede enviar a un flujo.');
    if (radicado.estado === 'EN_TRAMITE') throw conflicto('Ese radicado ya está en un trámite.');
    if (radicado.estado === 'FINALIZADO') throw conflicto('Ese radicado ya terminó su trámite.');

    const id = await this.repo.crear(
      {
        radicadoId: radicado.id,
        radicadoCodigo: radicado.codigo,
        radicadoAsunto: radicado.asunto,
        flujoId: flujo.id,
        flujoNombre: flujo.nombre,
        versionId: flujo.versionId,
        estadoInicial: inicial,
        slaGlobal: flujo.sla,
      },
      autor(actor),
    );

    // El estado del radicado es un dato de documentos; si el aviso falla, el trámite
    // igual quedó abierto y se puede corregir desde la bandeja.
    await this.avisar(() => this.documentos.marcarEstado(radicado.id, 'EN_TRAMITE'));
    return (await this.detalle(id, actor))!;
  }

  /** HU-063: la bandeja del actor, o todas si administra flujos. */
  async bandeja(actor: Actor): Promise<TareaBandeja[]> {
    return this.repo.bandeja(actor, actor.permisos.has('flujos:administrar'));
  }

  /** HU-070: tomar la tarea en exclusiva antes de decidir. */
  async tomar(tareaId: string, actor: Actor): Promise<TramiteDetalle> {
    const tarea = esId(tareaId) ? await this.repo.tarea(tareaId) : null;
    if (!tarea) throw noEncontrado('La tarea no existe.');
    if (tarea.tramiteEstado !== 'EN_CURSO') throw conflicto('El trámite ya está cerrado.');
    if (tarea.asignadaA && tarea.asignadaA !== actor.id) throw conflicto('Otra persona tomó esta tarea.');

    const responsables = await this.repo.responsablesDe(tarea.pasoId);
    if (!esResponsable(actor, responsables) && !actor.permisos.has('flujos:administrar')) {
      throw prohibido('Esta tarea está asignada a otra persona.');
    }
    await this.repo.tomar(tareaId, autor(actor));
    return (await this.detalle(tarea.tramiteId, actor))!;
  }

  /** HU-066…HU-068: aprobar, enviar, devolver o cancelar. */
  async ejecutar(tareaId: string, cuerpo: unknown, actor: Actor): Promise<TramiteDetalle> {
    const { accion, observacion } = this.validar<EjecutarTarea>(cuerpo, esquemaEjecutar);
    this.exigirPermiso(accion, actor);

    const tarea = esId(tareaId) ? await this.repo.tarea(tareaId) : null;
    if (!tarea) throw noEncontrado('La tarea no existe.');
    if (tarea.tramiteEstado !== 'EN_CURSO') throw conflicto('El trámite ya está cerrado.');
    if (tarea.asignadaA && tarea.asignadaA !== actor.id) throw conflicto('Otra persona tomó esta tarea.');

    const responsables = await this.repo.responsablesDe(tarea.pasoId);
    if (!esResponsable(actor, responsables) && !actor.permisos.has('flujos:administrar')) {
      throw prohibido('Esta tarea está asignada a otra persona.');
    }

    const transicion = await this.repo.transicionDesde(tarea.pasoId, accion);
    if (!transicion) {
      throw noProcesable(`La acción ${accion} no está disponible en el paso «${tarea.pasoNombre}».`, [
        'Revisa la definición del flujo o elige otra acción.',
      ]);
    }

    // Tomarla implícitamente si aún está pendiente: el usuario ya decidió la acción.
    if (tarea.estado === 'PENDIENTE') await this.repo.tomar(tareaId, autor(actor));

    const resultado = await this.repo.ejecutar(
      tareaId,
      { accion, observacion: observacion ?? null, transicionId: transicion.id, destinoId: transicion.destinoId },
      autor(actor),
    );

    if (resultado.estado === 'FINALIZADO') {
      await this.avisar(() => this.documentos.marcarEstado(tarea.radicadoId, 'FINALIZADO'));
    } else if (resultado.estado === 'CANCELADO') {
      await this.avisar(() => this.documentos.marcarEstado(tarea.radicadoId, 'RADICADO'));
    }
    return (await this.detalle(resultado.tramiteId, actor))!;
  }

  /** HU-063: el detalle del trámite con su historial, ajustado al actor. */
  async detalle(id: string, actor: Actor): Promise<TramiteDetalle | null> {
    const detalle = esId(id) ? await this.repo.detalle(id) : null;
    if (!detalle) throw noEncontrado('El trámite no existe.');
    return this.ajustar(detalle, actor);
  }

  /** El trámite de un radicado, para mostrarlo en la pantalla de radicación. */
  async porRadicado(radicadoId: string, actor: Actor): Promise<TramiteDetalle | null> {
    if (!esId(radicadoId)) return null;
    const detalle = await this.repo.porRadicado(radicadoId);
    return detalle ? this.ajustar(detalle, actor) : null;
  }

  /** Igual que `porRadicado`, pero responde 404 si no hay trámite (`GET tramites?radicadoId`). */
  async exigirPorRadicado(radicadoId: unknown, actor: Actor): Promise<TramiteDetalle> {
    const detalle = typeof radicadoId === 'string' ? await this.porRadicado(radicadoId, actor) : null;
    if (!detalle) throw noEncontrado('El radicado no tiene trámite.');
    return detalle;
  }

  private ajustar(detalle: TramiteDetalle, actor: Actor): TramiteDetalle {
    const tarea = detalle.tareaAbierta;
    if (!tarea) return detalle;
    const atiende = esResponsable(actor, tarea.responsables);
    const administra = actor.permisos.has('flujos:administrar');
    tarea.esMia = tarea.asignadaA === actor.id;
    tarea.supervision = administra && !atiende;
    // Nadie ve las acciones de una tarea que otro ya tomó.
    if (tarea.asignadaA && tarea.asignadaA !== actor.id) tarea.acciones = [];
    if (!atiende && !administra) tarea.acciones = [];
    return detalle;
  }

  private async exigirFlujo(id: string): Promise<void> {
    if (!esId(id) || !(await this.repo.existeFlujo(id))) throw noEncontrado('No existe un flujo con ese identificador.');
  }

  private exigirPermiso(accion: Accion, actor: Actor): void {
    if ((accion === 'DEVOLVER' || accion === 'CANCELAR') && !actor.permisos.has('flujo:rechazar')) {
      throw prohibido(`Requiere el permiso flujo:rechazar para ${accion.toLowerCase()}.`);
    }
    if (!actor.permisos.has('flujo:aprobar')) {
      throw prohibido('Requiere el permiso flujo:aprobar para atender la tarea.');
    }
  }

  /** El aviso a documentos no tumba la operación: se registra y se sigue. */
  private async avisar(accion: () => Promise<void>): Promise<void> {
    try {
      await accion();
    } catch (error: any) {
      console.warn('No se pudo actualizar el estado del radicado:', error?.message ?? error);
    }
  }

  private validar<T>(cuerpo: unknown, esquema: { safeParse: (v: unknown) => any }): T {
    const analisis = esquema.safeParse(cuerpo ?? {});
    if (!analisis.success) throw datosInvalidos('Hay datos inválidos en la solicitud.', detallesDe(analisis.error));
    return analisis.data as T;
  }
}

function autor(actor: Actor) {
  return { id: actor?.id ?? null, correo: actor?.correo ?? null };
}
