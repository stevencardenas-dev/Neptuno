import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Actor, ActorActual, AutenticacionGuard, RequierePermiso } from '../autenticacion';
import { ServicioFlujos } from './servicio';

/**
 * Diseñador de flujos (HU-048…HU-051). Todas las rutas exigen `flujos:administrar`: quien
 * diseña flujos no es necesariamente quien los inicia (HU-062, permiso `flujo:iniciar`).
 */
@Controller('api/workflow/flujos')
@UseGuards(AutenticacionGuard)
export class FlujosControlador {
  constructor(private readonly servicio: ServicioFlujos) {}

  /** HU-049: listar y buscar flujos. */
  @Get()
  @RequierePermiso('flujos:administrar')
  listar(@Query() consulta: Record<string, unknown>) {
    return this.servicio.listar(consulta);
  }

  /** HU-049: consultar el detalle de un flujo. */
  @Get(':id')
  @RequierePermiso('flujos:administrar')
  consultar(@Param('id') id: string) {
    return this.servicio.consultar(id);
  }

  /** HU-048: crear un flujo. */
  @Post()
  @RequierePermiso('flujos:administrar')
  crear(@Body() cuerpo: unknown, @ActorActual() actor: Actor) {
    return this.servicio.crear(cuerpo, actor);
  }

  /** HU-051: editar nombre y descripción. */
  @Put(':id')
  @RequierePermiso('flujos:administrar')
  editar(@Param('id') id: string, @Body() cuerpo: unknown, @ActorActual() actor: Actor) {
    return this.servicio.editar(id, cuerpo, actor);
  }
}
