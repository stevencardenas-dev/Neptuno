import { Module } from '@nestjs/common';
import { CONFIG, Config } from '../config';
import { crearClienteCatalogos } from '../disenador/catalogos';
import { CATALOGOS } from '../disenador/servicio';
import { TramitesControlador } from './controlador';
import { RepositorioTramites } from './repositorio';
import { ServicioTramites } from './servicio';

@Module({
  controllers: [TramitesControlador],
  providers: [
    RepositorioTramites,
    ServicioTramites,
    { provide: CATALOGOS, useFactory: (config: Config) => crearClienteCatalogos(config.catalogos.url), inject: [CONFIG] },
  ],
})
export class TramitesModule {}
