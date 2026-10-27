import { Module } from '@nestjs/common';
import { CONFIG, Config } from '../config';
import { crearClienteCatalogos } from '../disenador/catalogos';
import { CATALOGOS } from '../disenador/servicio';
import { TramitesControlador } from './controlador';
import { crearClienteDocumentos, DOCUMENTOS } from './documentos';
import { RepositorioTramites } from './repositorio';
import { ServicioTramites } from './servicio';

/**
 * Vínculo flujo ↔ tipo documental, trámites y bandeja (HU-062…HU-074). Los clientes de
 * catálogos y de documentos se construyen una sola vez; el de documentos usa la clave de
 * servicio que comparten los microservicios.
 */
@Module({
  controllers: [TramitesControlador],
  providers: [
    RepositorioTramites,
    ServicioTramites,
    { provide: CATALOGOS, useFactory: (config: Config) => crearClienteCatalogos(config.catalogos.url), inject: [CONFIG] },
    {
      provide: DOCUMENTOS,
      useFactory: (config: Config) => crearClienteDocumentos(config.documentos),
      inject: [CONFIG],
    },
  ],
})
export class TramitesModule {}
