import { Module } from '@nestjs/common';
import { CONFIG, Config } from '../config';
import { TramitesControlador } from './controlador';
import { crearClienteDocumentos, DOCUMENTOS } from './documentos';
import { RepositorioTramites } from './repositorio';
import { ServicioTramites } from './servicio';

/**
 * Trámites y bandeja (HU-062…HU-074). El cliente de documentos se construye una sola vez
 * con la dirección y la clave de servicio que comparten los microservicios.
 */
@Module({
  controllers: [TramitesControlador],
  providers: [
    RepositorioTramites,
    ServicioTramites,
    {
      provide: DOCUMENTOS,
      useFactory: (config: Config) => crearClienteDocumentos(config.documentos),
      inject: [CONFIG],
    },
  ],
})
export class TramitesModule {}
