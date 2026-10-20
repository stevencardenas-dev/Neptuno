import { Module } from '@nestjs/common';
import { BANDEJA } from '../eventos';
import { FlujosControlador } from './controlador';
import { RepositorioFlujos } from './repositorio';
import { ServicioFlujos } from './servicio';

@Module({
  controllers: [FlujosControlador],
  providers: [RepositorioFlujos, ServicioFlujos, { provide: BANDEJA, useExisting: RepositorioFlujos }],
  // El publicador de la bandeja de salida vive en el módulo raíz y necesita el repositorio.
  exports: [BANDEJA],
})
export class FlujosModule {}
