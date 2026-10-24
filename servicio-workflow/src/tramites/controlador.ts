import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Actor, ActorActual, AutenticacionGuard, RequierePermiso, TokenActual } from '../autenticacion';
import { ServicioTramites } from './servicio';

/**
 * Vínculo flujo ↔ tipo documental (lo administra quien diseña flujos) y trámites (los
 * inicia quien radica, con el permiso `radicados:crear` que ya trae el rol Radicador;
 * HU-062 lo separará en `flujo:iniciar`).
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

  /** Flujos entre los que puede elegir quien radica un documento de ese tipo. */
  @Get('flujos-disponibles')
  @RequierePermiso('radicados:crear')
  disponibles(@Query('tipoDocumentalId') tipoDocumentalId: unknown) {
    return this.servicio.disponibles(tipoDocumentalId);
  }

  @Post('tramites')
  @RequierePermiso('radicados:crear')
  iniciar(@Body() cuerpo: unknown, @ActorActual() actor: Actor) {
    return this.servicio.iniciar(cuerpo, actor);
  }

  @Get('tramites')
  @RequierePermiso('radicados:consultar')
  porRadicado(@Query('radicadoId') radicadoId: unknown) {
    return this.servicio.porRadicado(radicadoId);
  }
}
