import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearApp } from '../src/app.js';
import { crearRepositorioMemoria } from '../src/radicados/repositorio-memoria.js';

// El API se monta con el repositorio en memoria: así se comprueba que todas las rutas
// nuevas (expediente, plantillas, copias y anexos) se enganchan sin depender de MySQL.

test('el API se monta y responde el healthcheck', async () => {
  const app = crearApp({
    config: { claveServicios: null, jwt: { secreto: 'x'.repeat(40), emisor: 'pruebas' } },
    repo: crearRepositorioMemoria(),
    catalogos: {},
    comprobarSalud: async () => {},
  });
  const servidor = app.listen(0);
  try {
    const { port } = servidor.address();
    const respuesta = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), { estado: 'UP' });
  } finally {
    servidor.close();
  }
});
