import { Module } from '@nestjs/common';
import { CONFIG, Config } from '../config';
import { crearClienteCatalogos } from '../disenador/catalogos';
import { CATALOGOS } from '../disenador/servicio';
import { GruposControlador } from './controlador';
import { RepositorioGrupos } from './repositorio';
import { ServicioGrupos } from './servicio';

/** Grupos de trabajo (HU-069): los miembros se validan contra ms-auth-catalogs. */
@Module({
  controllers: [GruposControlador],
  providers: [
    RepositorioGrupos,
    ServicioGrupos,
    { provide: CATALOGOS, useFactory: (config: Config) => crearClienteCatalogos(config.catalogos.url), inject: [CONFIG] },
  ],
})
export class GruposModule {}
