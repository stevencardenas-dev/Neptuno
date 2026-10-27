import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Actor, ActorActual, AutenticacionGuard, RequierePermiso } from '../autenticacion';
import { ServicioTramites } from './servicio';

/**
 * Bandeja de entrada y trámites (HU-062…HU-074).
 *
 * `flujo:iniciar` abre el trámite; `flujo:aprobar` da acceso a la bandeja y a tomar una
 * tarea. Ejecutar la acción no lleva guardia de permiso porque depende de la acción
 * (devolver y cancelar exigen además `flujo:rechazar`) y el servicio lo comprueba.
 */
@Controller('api/workflow')
@UseGuards(AutenticacionGuard)
export class TramitesControlador {
  constructor(private readonly servicio: ServicioTramites) {}

  /** Flujos publicados a los que se puede enviar un radicado. */
  @Get('flujos-publicados')
  @RequierePermiso('flujo:iniciar')
  flujosPublicados() {
    return this.servicio.flujosPublicados();
  }

  /** HU-062: enviar un radicado a un flujo. */
  @Post('tramites')
  @RequierePermiso('flujo:iniciar')
  iniciar(@Body() cuerpo: unknown, @ActorActual() actor: Actor) {
    return this.servicio.iniciar(cuerpo, actor);
  }

  /** HU-063: la bandeja del usuario autenticado. */
  @Get('bandeja')
  @RequierePermiso('flujo:aprobar')
  bandeja(@ActorActual() actor: Actor) {
    return this.servicio.bandeja(actor);
  }

  /** El trámite de un radicado (para la pantalla de radicación). */
  @Get('tramites/radicado/:radicadoId')
  @RequierePermiso('radicados:consultar')
  porRadicado(@Param('radicadoId') radicadoId: string, @ActorActual() actor: Actor) {
    return this.servicio.porRadicado(radicadoId, actor);
  }

  /** HU-063: detalle con su historial. */
  @Get('tramites/:id')
  @RequierePermiso('flujo:aprobar')
  detalle(@Param('id') id: string, @ActorActual() actor: Actor) {
    return this.servicio.detalle(id, actor);
  }

  /** HU-070: tomar la tarea. */
  @Post('tareas/:id/tomar')
  @RequierePermiso('flujo:aprobar')
  tomar(@Param('id') id: string, @ActorActual() actor: Actor) {
    return this.servicio.tomar(id, actor);
  }

  /** HU-066…HU-068: aprobar, enviar, devolver o cancelar. */
  @Post('tareas/:id/ejecutar')
  ejecutar(@Param('id') id: string, @Body() cuerpo: unknown, @ActorActual() actor: Actor) {
    return this.servicio.ejecutar(id, cuerpo, actor);
  }
}
