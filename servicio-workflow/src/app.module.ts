import { Module } from '@nestjs/common';
import { DisenadorModule } from './disenador/modulo';
import { PublicadorEventos } from './eventos';
import { FlujosModule } from './flujos/modulo';
import { NucleoModule } from './nucleo.module';
import { SaludControlador } from './salud.controlador';

@Module({
  imports: [NucleoModule, FlujosModule, DisenadorModule],
  controllers: [SaludControlador],
  providers: [PublicadorEventos],
})
export class AppModule {}
