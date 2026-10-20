import { Module } from '@nestjs/common';
import { CONFIG, Config } from '../config';
import { crearClienteCatalogos } from './catalogos';
import { DisenadorControlador } from './controlador';
import { RepositorioDisenador } from './repositorio';
import { CATALOGOS, ServicioDisenador } from './servicio';

/**
 * Diseñador de flujos (HU-050, HU-052…HU-061). El cliente de catálogos se construye una
 * sola vez con la dirección de servicio-usuarios: se usa para validar los roles y las
 * áreas que se asignan a un paso (HU-059).
 */
@Module({
  controllers: [DisenadorControlador],
  providers: [
    RepositorioDisenador,
    ServicioDisenador,
    { provide: CATALOGOS, useFactory: (config: Config) => crearClienteCatalogos(config.catalogos.url), inject: [CONFIG] },
  ],
})
export class DisenadorModule {}
