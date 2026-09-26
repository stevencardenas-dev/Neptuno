package co.gov.neptuno.usuarios.auditoria;

import co.gov.neptuno.usuarios.comun.EstadoPublicacion;
import co.gov.neptuno.usuarios.config.PropiedadesNeptuno;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Publica los eventos de dominio en RabbitMQ para que ms-audit-infra construya la
 * bitácora inalterable (HU-043). Cada evento queda además en {@code evento_auditoria}
 * con su estado de publicación, de modo que el servicio siga siendo demostrable sin
 * broker y los pendientes se reintenten más tarde.
 */
@Service
public class PublicadorEventos {

    private static final Logger registro = LoggerFactory.getLogger(PublicadorEventos.class);

    private final RepositorioEventoAuditoria repositorio;
    private final RabbitTemplate plantilla;
    private final PropiedadesNeptuno propiedades;

    public PublicadorEventos(RepositorioEventoAuditoria repositorio,
                             RabbitTemplate plantilla,
                             PropiedadesNeptuno propiedades) {
        this.repositorio = repositorio;
        this.plantilla = plantilla;
        this.propiedades = propiedades;
    }

    /**
     * Registra un evento de bitácora y lo publica en RabbitMQ.
     *
     * @param tipo       tipo técnico, p. ej. {@code usuario.creado}
     * @param entidad    agregado afectado, p. ej. {@code usuario}
     * @param entidadId  identificador del agregado
     * @param actorId    usuario que ejecuta la acción (null si es el sistema)
     * @param actorCorreo correo del actor, para la bitácora
     * @param detalle    descripción legible del hecho
     */
    @Transactional
    public void publicar(String tipo, String entidad, String entidadId, UUID actorId, String actorCorreo, String detalle) {
        EventoAuditoria evento = new EventoAuditoria();
        evento.setTipo(tipo);
        evento.setEntidad(entidad);
        evento.setEntidadId(entidadId);
        evento.setActorId(actorId);
        evento.setActorCorreo(actorCorreo);
        evento.setDetalle(detalle);
        evento.setOcurridoEn(Instant.now());
        evento.setEstadoPublicacion(EstadoPublicacion.PENDIENTE);
        repositorio.save(evento);

        if (!propiedades.getEventos().isPublicar()) {
            return;
        }
        if (enviar(evento)) {
            evento.setEstadoPublicacion(EstadoPublicacion.PUBLICADO);
            repositorio.save(evento);
        }
    }

    /** Reintenta los eventos que quedaron pendientes cuando el broker no estaba disponible. */
    @Scheduled(fixedDelayString = "PT30S")
    @Transactional
    public void reintentarPendientes() {
        if (!propiedades.getEventos().isPublicar()) {
            return;
        }
        for (EventoAuditoria evento : repositorio.findTop100ByEstadoPublicacionOrderByOcurridoEnAsc(EstadoPublicacion.PENDIENTE)) {
            if (!enviar(evento)) {
                return;
            }
            evento.setEstadoPublicacion(EstadoPublicacion.PUBLICADO);
            repositorio.save(evento);
        }
    }

    private boolean enviar(EventoAuditoria evento) {
        try {
            Map<String, Object> mensaje = new LinkedHashMap<>();
            mensaje.put("id", evento.getId().toString());
            mensaje.put("tipo", evento.getTipo());
            mensaje.put("entidad", evento.getEntidad());
            mensaje.put("entidadId", evento.getEntidadId());
            mensaje.put("actorId", evento.getActorId() == null ? null : evento.getActorId().toString());
            mensaje.put("actorCorreo", evento.getActorCorreo());
            mensaje.put("detalle", evento.getDetalle());
            mensaje.put("ocurridoEn", evento.getOcurridoEn().toString());
            mensaje.put("servicio", "servicio-usuarios");
            plantilla.convertAndSend(propiedades.getEventos().getExchange(),
                    propiedades.getEventos().getRoutingKey(), mensaje);
            return true;
        } catch (AmqpException excepcion) {
            registro.warn("No se pudo publicar el evento {} ({}); quedará pendiente para reintento.",
                    evento.getId(), excepcion.getMessage());
            return false;
        }
    }
}
