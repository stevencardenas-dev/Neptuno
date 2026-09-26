package co.gov.neptuno.usuarios.comun;

/** Estado de publicación de un evento de bitácora hacia RabbitMQ (ms-audit-infra). */
public enum EstadoPublicacion {
    PENDIENTE,
    PUBLICADO
}
