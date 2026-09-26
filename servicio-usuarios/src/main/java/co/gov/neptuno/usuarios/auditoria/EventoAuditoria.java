package co.gov.neptuno.usuarios.auditoria;

import co.gov.neptuno.usuarios.comun.EstadoPublicacion;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Evento de bitácora generado por el servicio (HU-043 dentro del sprint base).
 *
 * <p>El historial inalterable vive en ms-audit-infra; este servicio publica cada evento
 * en RabbitMQ y conserva una copia local con su estado de publicación para poder
 * reintentar si el broker no está disponible.</p>
 */
@Entity
@Table(name = "evento_auditoria")
@Getter
@Setter
@NoArgsConstructor
public class EventoAuditoria {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Tipo técnico del evento, p. ej. {@code usuario.creado} o {@code sesion.iniciada}. */
    @Column(nullable = false, length = 60)
    private String tipo;

    @Column(nullable = false, length = 60)
    private String entidad;

    @Column(name = "entidad_id", length = 64)
    private String entidadId;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_correo", length = 160)
    private String actorCorreo;

    @Column(length = 1000)
    private String detalle;

    @Column(name = "ocurrido_en", nullable = false)
    private Instant ocurridoEn;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_publicacion", nullable = false, length = 16)
    private EstadoPublicacion estadoPublicacion = EstadoPublicacion.PENDIENTE;

    @PrePersist
    void alCrear() {
        if (ocurridoEn == null) {
            ocurridoEn = Instant.now();
        }
    }
}
