import mysql from 'mysql2/promise';
import { crearApp } from './app.js';
import { crearClienteCatalogos } from './catalogos.js';
import { cargarConfig } from './config.js';
import { crearPublicador } from './eventos.js';
import { migrar } from './migrar.js';
import { crearRepositorioMysql } from './radicados/repositorio-mysql.js';

const config = cargarConfig();

const pool = mysql.createPool({
  ...config.db,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: ['DATE'],
});

await migrar(pool);

const repo = crearRepositorioMysql(pool);
const publicador = crearPublicador({ repo, config: config.eventos });
const app = crearApp({
  config,
  repo,
  catalogos: crearClienteCatalogos(config.usuariosUrl),
  comprobarSalud: () => pool.query('select 1'),
});

const servidor = app.listen(config.puerto, () => console.info(`servicio-documentos escuchando en el puerto ${config.puerto}`));
publicador.iniciar();

async function apagar() {
  servidor.close();
  await publicador.detener();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', apagar);
process.on('SIGINT', apagar);
