import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { POOL } from './db';

/** Sonda de vida: responde 503 si la base no contesta, como los otros servicios. */
@Controller('healthz')
export class SaludControlador {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  @Get()
  async salud() {
    await this.pool.query('select 1');
    return { estado: 'UP', servicio: 'servicio-workflow' };
  }
}
