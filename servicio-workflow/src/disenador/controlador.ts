import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Actor, ActorActual, AutenticacionGuard, RequierePermiso, TokenActual } from '../autenticacion';
import { ServicioDisenador } from './servicio';

/**
 * Diseñador de flujos (HU-050 y HU-052…HU-061): los pasos, las transiciones, los
 * responsables, la publicación y el archivo del flujo. Todas las rutas exigen
 * `flujos:administrar`; quien diseña flujos no es quien los inicia (HU-062).
 *
 * Las rutas cuelgan de `/flujos/{id}` porque el diseñador trabaja sobre una versión del
 * flujo, que el servicio resuelve por dentro.
 */
@Controller('api/workflow/flujos/:id')
@UseGuards(AutenticacionGuard)
export class DisenadorControlador {
  constructor(private readonly servicio: ServicioDisenador) {}

  /** HU-052: el flujo dibujado en un lienzo. */
  @Get('grafo')
  @RequierePermiso('flujos:administrar')
  grafo(@Param('id') id: string) {
    return this.servicio.grafo(id);
  }

  /** HU-053: agregar un paso. */
  @Post('estados')
  @RequierePermiso('flujos:administrar')
  agregarPaso(@Param('id') id: string, @Body() cuerpo: unknown, @ActorActual() actor: Actor) {
    return this.servicio.agregarPaso(id, cuerpo, actor);
  }

  /** HU-054: corregir un paso. */
  @Put('estados/:estadoId')
  @RequierePermiso('flujos:administrar')
  editarPaso(
    @Param('id') id: string,
    @Param('estadoId') estadoId: string,
    @Body() cuerpo: unknown,
    @ActorActual() actor: Actor,
  ) {
    return this.servicio.editarPaso(id, estadoId, cuerpo, actor);
  }

  /** HU-055: marcar el paso como inicial, intermedio o final. */
  @Patch('estados/:estadoId/tipo')
  @RequierePermiso('flujos:administrar')
  marcarPaso(
    @Param('id') id: string,
    @Param('estadoId') estadoId: string,
    @Body() cuerpo: unknown,
    @ActorActual() actor: Actor,
  ) {
    return this.servicio.marcarPaso(id, estadoId, cuerpo, actor);
  }

  /** HU-054: retirar un paso. */
  @Delete('estados/:estadoId')
  @RequierePermiso('flujos:administrar')
  retirarPaso(@Param('id') id: string, @Param('estadoId') estadoId: string, @ActorActual() actor: Actor) {
    return this.servicio.retirarPaso(id, estadoId, actor);
  }

  /** HU-056: crear una transición. */
  @Post('transiciones')
  @RequierePermiso('flujos:administrar')
  agregarTransicion(@Param('id') id: string, @Body() cuerpo: unknown, @ActorActual() actor: Actor) {
    return this.servicio.agregarTransicion(id, cuerpo, actor);
  }

  /** HU-057: editar una transición. */
  @Put('transiciones/:transicionId')
  @RequierePermiso('flujos:administrar')
  editarTransicion(
    @Param('id') id: string,
    @Param('transicionId') transicionId: string,
    @Body() cuerpo: unknown,
    @ActorActual() actor: Actor,
  ) {
    return this.servicio.editarTransicion(id, transicionId, cuerpo, actor);
  }

  /** HU-058: eliminar una transición. */
  @Delete('transiciones/:transicionId')
  @RequierePermiso('flujos:administrar')
  retirarTransicion(
    @Param('id') id: string,
    @Param('transicionId') transicionId: string,
    @ActorActual() actor: Actor,
  ) {
    return this.servicio.retirarTransicion(id, transicionId, actor);
  }

  /** HU-059: asignar un rol, un área, un usuario o un grupo al paso. */
  @Post('estados/:estadoId/responsables')
  @RequierePermiso('flujos:administrar')
  asignarResponsable(
    @Param('id') id: string,
    @Param('estadoId') estadoId: string,
    @Body() cuerpo: unknown,
    @ActorActual() actor: Actor,
    @TokenActual() token: string,
  ) {
    return this.servicio.asignarResponsable(id, estadoId, cuerpo, actor, token);
  }

  /** HU-060: quitar un responsable del paso. */
  @Delete('estados/:estadoId/responsables/:responsableId')
  @RequierePermiso('flujos:administrar')
  quitarResponsable(
    @Param('id') id: string,
    @Param('estadoId') estadoId: string,
    @Param('responsableId') responsableId: string,
    @ActorActual() actor: Actor,
  ) {
    return this.servicio.quitarResponsable(id, estadoId, responsableId, actor);
  }

  /** HU-061: publicar el flujo, si está completo. */
  @Post('publicar')
  @RequierePermiso('flujos:administrar')
  publicar(@Param('id') id: string, @ActorActual() actor: Actor) {
    return this.servicio.publicar(id, actor);
  }

  /** HU-050: archivar el flujo. */
  @Patch('desactivar')
  @RequierePermiso('flujos:administrar')
  desactivar(@Param('id') id: string, @ActorActual() actor: Actor) {
    return this.servicio.desactivar(id, actor);
  }

  /** HU-050: devolver el flujo a la operación. */
  @Patch('reactivar')
  @RequierePermiso('flujos:administrar')
  reactivar(@Param('id') id: string, @ActorActual() actor: Actor) {
    return this.servicio.reactivar(id, actor);
  }
}
