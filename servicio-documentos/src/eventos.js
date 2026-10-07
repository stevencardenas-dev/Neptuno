import amqp from 'amqplib';

// Publica el outbox en RabbitMQ para ms-audit-infra (mismo exchange, cola y mensaje que
// servicio-usuarios). Si el broker no responde, los eventos quedan pendientes y se
// reintentan en el siguiente ciclo: las operaciones del usuario nunca esperan al broker.
export function crearPublicador({ repo, config, registro = console }) {
  let conexion = null;
  let canal = null;
  let temporizador = null;
  let enCurso = false;

  async function conectar() {
    conexion = await amqp.connect(config.url);
    conexion.on('error', () => {});
    conexion.on('close', () => { conexion = null; canal = null; });
    canal = await conexion.createChannel();
    await canal.assertExchange(config.exchange, 'direct', { durable: true });
    await canal.assertQueue(config.cola, { durable: true });
    await canal.bindQueue(config.cola, config.exchange, config.routingKey);
  }

  async function enviarPendientes() {
    if (enCurso) return;
    enCurso = true;
    try {
      const pendientes = await repo.eventosPendientes(100);
      if (!pendientes.length) return;
      if (!canal) await conectar();
      const publicados = [];
      for (const e of pendientes) {
        const mensaje = {
          id: e.id,
          tipo: e.tipo,
          entidad: e.entidad,
          entidadId: e.entidadId,
          actorId: e.actorId,
          actorCorreo: e.actorCorreo,
          detalle: e.detalle,
          ocurridoEn: new Date(e.ocurridoEn).toISOString(),
          servicio: 'servicio-documentos',
        };
        canal.publish(config.exchange, config.routingKey, Buffer.from(JSON.stringify(mensaje)), {
          persistent: true,
          contentType: 'application/json',
        });
        publicados.push(e.id);
      }
      await repo.marcarPublicados(publicados);
    } catch (error) {
      registro.warn(`No se pudieron publicar los eventos (${error.message}); se reintentará.`);
      try { await conexion?.close(); } catch { /* ya cerrada */ }
      conexion = null;
      canal = null;
    } finally {
      enCurso = false;
    }
  }

  return {
    iniciar() {
      if (config.publicar) temporizador = setInterval(enviarPendientes, config.intervaloMs);
    },
    enviarPendientes,
    async detener() {
      clearInterval(temporizador);
      try { await conexion?.close(); } catch { /* ya cerrada */ }
    },
  };
}
