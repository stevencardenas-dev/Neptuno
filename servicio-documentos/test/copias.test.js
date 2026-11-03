import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearServicioCopias } from '../src/copias/servicio.js';

// HU-041: una copia se envía a un usuario activo, que no sea quien la envía, y un
// radicado anulado no admite copias.

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const RADICADO = uuid(1);
const AUTOR = uuid(2);
const DESTINO = uuid(3);
const actor = { id: AUTOR, correo: 'ana@neptuno.gov.co', token: 'token' };

function escenario({ existeDestino = true, estado = 'RADICADO' } = {}) {
  const creadas = [];
  const repo = {
    radicado: async () => ({ id: RADICADO, codigo: '20261028010001', asunto: 'Compra', origen: 'INTERNO', estado }),
    crear: async (datos, quien) => {
      creadas.push({ ...datos, actor: quien.id });
      return { id: uuid(9), ...datos, radicado: { id: RADICADO } };
    },
    bandeja: async (destinatario, opciones) => [{ destinatarioId: destinatario, ...opciones }],
    enviadas: async () => [],
    obtener: async () => ({ id: uuid(9), destinatarioId: DESTINO }),
    marcarLeida: async (id, destinatario) => ({ id, destinatarioId: destinatario, actualizada: true }),
  };
  const catalogos = { usuario: async () => (existeDestino ? { id: DESTINO } : null) };
  return { servicio: crearServicioCopias({ repo, catalogos }), creadas };
}

test('enviar una copia valida el destinatario y la registra', async () => {
  const { servicio, creadas } = escenario();
  const copia = await servicio.enviar(actor, RADICADO, { destinatarioId: DESTINO, mensaje: 'Para tu revisión' });
  assert.equal(creadas.length, 1);
  assert.equal(creadas[0].destinatarioId, DESTINO);
  assert.equal(copia.mensaje, 'Para tu revisión');
});

test('no se envía copia a un usuario inactivo ni a uno mismo', async () => {
  const inactivo = escenario({ existeDestino: false });
  await assert.rejects(
    inactivo.servicio.enviar(actor, RADICADO, { destinatarioId: DESTINO }),
    (error) => error.estado === 400 && /no existe o está inactivo/.test(error.message),
  );
  const propio = escenario();
  await assert.rejects(
    propio.servicio.enviar(actor, RADICADO, { destinatarioId: AUTOR }),
    (error) => error.estado === 400 && /ti mismo/.test(error.message),
  );
});

test('un radicado anulado no recibe copias', async () => {
  const { servicio } = escenario({ estado: 'ANULADO' });
  await assert.rejects(
    servicio.enviar(actor, RADICADO, { destinatarioId: DESTINO }),
    (error) => error.estado === 409,
  );
});
