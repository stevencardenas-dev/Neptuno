import { Global, Module } from '@nestjs/common';
import { AutenticacionGuard } from './autenticacion';
import { CONFIG, cargarConfig, Config } from './config';
import { crearPool, migrar, POOL } from './db';

const config = cargarConfig();

/**
 * Configuración, base de datos y guardia de autenticación: lo que todo módulo necesita.
 * El pool se crea cuando Nest lo pide por primera vez y aplica las migraciones antes de
 * atender la primera petición, igual que hacen los otros servicios al arrancar.
 */
@Global()
@Module({
  providers: [
    { provide: CONFIG, useValue: config },
    {
      provide: POOL,
      useFactory: async (cfg: Config) => {
        const pool = crearPool(cfg);
        await migrar(pool);
        return pool;
      },
      inject: [CONFIG],
    },
    AutenticacionGuard,
  ],
  exports: [CONFIG, POOL, AutenticacionGuard],
})
export class NucleoModule {}
