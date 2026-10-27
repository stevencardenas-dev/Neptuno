import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Actor, ActorActual, AutenticacionGuard, RequierePermiso, TokenActual } from '../autenticacion';
import { ServicioTramites } from './servicio';

/**
 * Vínculo flujo ↔ tipo documental, trámites y bandeja de entrada (HU-062…HU-074).
 *
 * El vínculo lo administra quien diseña flujos. Abrir un trámite admite `radicados:crear`
 * (servicio-documentos lo abre con el token de quien radica) o `flujo:iniciar` (el envío
 * a un flujo de un radicado ya registrado). `flujo:aprobar` da acceso a la bandeja y a
 * tomar una tarea. Ejecutar la acción no lleva guardia de permiso porque depende de la
 * acción (devolver y cancelar exigen además `flujo:rechazar`) y el servicio lo comprueba.
 */
@Controller('api/workflow')
@UseGuards(AutenticacionGuard)
export class TramitesControlador {
  constructor(private readonly servicio: ServicioTramites) {}

  @Get('flujos/:id/tipos-documentales')
  @RequierePermiso('flujos:administrar')
  tipos(@Param('id') id: string) {
    return this.servicio.tiposDelFlujo(id);
  }

  @Put('flujos/:id/tipos-documentales')
  @RequierePermiso('flujos:administrar')
  asignarTipos(@Param('id') id: string, @Body() cuerpo: unknown, @ActorActual() actor: Actor, @TokenActual() token: string) {
    return this.servicio.asignarTipos(id, cuerpo, actor, token);
  }

  /** Flujos activos que atienden un tipo documental: al radicar o al enviar después. */
  @Get('flujos-disponibles')
  @RequierePermiso('radicados:crear', 'flujo:iniciar')
  disponibles(@Query('tipoDocumentalId') tipoDocumentalId: unknown) {
    return this.servicio.disponibles(tipoDocumentalId);
  }

  /** HU-062: enviar un radicado a un flujo. */
  @Post('tramites')
  @RequierePermiso('radicados:crear', 'flujo:iniciar')
  iniciar(@Body() cuerpo: unknown, @ActorActual() actor: Actor) {
    return this.servicio.iniciar(cuerpo, actor);
  }

  /** El trámite más reciente de un radicado; 404 si no tiene. */
  @Get('tramites')
  @RequierePermiso('radicados:consultar')
  porRadicadoConsulta(@Query('radicadoId') radicadoId: unknown, @ActorActual() actor: Actor) {
    return this.servicio.exigirPorRadicado(radicadoId, actor);
  }

  /** HU-063: la bandeja del usuario autenticado. */
  @Get('bandeja')
  @RequierePermiso('flujo:aprobar')
  bandeja(@ActorActual() actor: Actor) {
    return this.servicio.bandeja(actor);
  }

  /** El trámite de un radicado (para la pantalla de radicación); null si no tiene. */
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
