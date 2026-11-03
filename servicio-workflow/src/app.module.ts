import { Module } from '@nestjs/common';
import { DisenadorModule } from './disenador/modulo';
import { PublicadorEventos } from './eventos';
import { FlujosModule } from './flujos/modulo';
import { GruposModule } from './grupos/modulo';
import { NucleoModule } from './nucleo.module';
import { SaludControlador } from './salud.controlador';
import { TramitesModule } from './tramites/modulo';

@Module({
  imports: [NucleoModule, FlujosModule, DisenadorModule, TramitesModule, GruposModule],
  controllers: [SaludControlador],
  providers: [PublicadorEventos],
})
export class AppModule {}
