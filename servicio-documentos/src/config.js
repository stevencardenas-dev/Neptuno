// Configuración por variables de entorno. Los secretos no tienen valor por defecto:
// sin ellos el servicio no arranca (igual que servicio-usuarios).
function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

export function cargarConfig() {
  const secreto = requerida('JWT_SECRETO');
  if (secreto.length < 32) throw new Error('JWT_SECRETO debe tener al menos 32 caracteres');
  const rabbitUsuario = encodeURIComponent(process.env.RABBIT_USUARIO ?? 'neptuno');
  const rabbitClave = encodeURIComponent(requerida('RABBIT_CLAVE'));
  return {
    puerto: Number(process.env.SERVER_PORT ?? 8082),
    jwt: { secreto, emisor: process.env.JWT_EMISOR ?? 'neptuno-ms-auth-catalogs' },
    db: {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      database: process.env.DB_NOMBRE ?? 'document_management_db',
      user: process.env.DB_USUARIO ?? 'neptuno',
      password: requerida('DB_CLAVE'),
    },
    usuariosUrl: process.env.USUARIOS_URL ?? 'http://localhost:8081',
    eventos: {
      publicar: (process.env.PUBLICAR_EVENTOS ?? 'true') === 'true',
      url: `amqp://${rabbitUsuario}:${rabbitClave}@${process.env.RABBIT_HOST ?? 'localhost'}:${process.env.RABBIT_PORT ?? 5672}`,
      exchange: process.env.EVENTOS_EXCHANGE ?? 'neptuno.eventos',
      cola: process.env.EVENTOS_COLA_AUDITORIA ?? 'audit.infrastructure',
      routingKey: process.env.EVENTOS_ROUTING_KEY ?? 'audit.evento',
      intervaloMs: Number(process.env.EVENTOS_INTERVALO_MS ?? 5000),
    },
  };
}
