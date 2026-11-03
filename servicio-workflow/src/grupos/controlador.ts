import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Actor, ActorActual, AutenticacionGuard, RequierePermiso, TokenActual } from '../autenticacion';
import { ServicioGrupos } from './servicio';

/**
 * Grupos de trabajo (HU-069). Cualquiera que atienda tareas puede consultarlos; solo
 * quien administra flujos los crea, edita o elimina.
 */
@Controller('api/workflow/grupos')
@UseGuards(AutenticacionGuard)
export class GruposControlador {
  constructor(private readonly servicio: ServicioGrupos) {}

  @Get()
  @RequierePermiso('flujo:aprobar', 'flujos:administrar')
  listar() {
    return this.servicio.listar();
  }

  @Get(':id')
  @RequierePermiso('flujo:aprobar', 'flujos:administrar')
  obtener(@Param('id') id: string) {
    return this.servicio.obtener(id);
  }

  @Post()
  @RequierePermiso('flujos:administrar')
  crear(@Body() cuerpo: unknown, @ActorActual() actor: Actor, @TokenActual() token: string) {
    return this.servicio.crear(cuerpo, actor, token);
  }

  @Put(':id')
  @RequierePermiso('flujos:administrar')
  editar(@Param('id') id: string, @Body() cuerpo: unknown, @ActorActual() actor: Actor) {
    return this.servicio.editar(id, cuerpo, actor);
  }

  @Put(':id/miembros')
  @RequierePermiso('flujos:administrar')
  miembros(@Param('id') id: string, @Body() cuerpo: unknown, @ActorActual() actor: Actor, @TokenActual() token: string) {
    return this.servicio.reemplazarMiembros(id, cuerpo, actor, token);
  }

  @Delete(':id')
  @RequierePermiso('flujos:administrar')
  eliminar(@Param('id') id: string, @ActorActual() actor: Actor) {
    return this.servicio.eliminar(id, actor);
  }
}
