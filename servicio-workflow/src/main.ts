import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CONFIG, Config } from './config';

async function arrancar(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableShutdownHooks();
  if (typeof app.getHttpAdapter().getInstance === 'function') {
    app.getHttpAdapter().getInstance()?.disable?.('x-powered-by');
  }
  const config = app.get<Config>(CONFIG);
  await app.listen(config.puerto, '0.0.0.0');
  console.info(`servicio-workflow escuchando en el puerto ${config.puerto}`);
}

arrancar().catch((error) => {
  console.error('No se pudo arrancar servicio-workflow:', error);
  process.exit(1);
});
