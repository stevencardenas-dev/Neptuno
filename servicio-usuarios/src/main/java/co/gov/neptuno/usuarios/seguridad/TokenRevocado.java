package co.gov.neptuno.usuarios.seguridad;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Token JWT revocado (HU-002). Al cerrar sesión se registra el identificador del token
 * (jti) hasta su expiración natural, de modo que no pueda reutilizarse.
 */
@Entity
@Table(name = "token_revocado")
@Getter
@Setter
@NoArgsConstructor
public class TokenRevocado {

    @Id
    @Column(length = 64)
    private String jti;

    @Column(name = "usuario_id")
    private UUID usuarioId;

    @Column(name = "expira_en", nullable = false)
    private Instant expiraEn;

    @Column(name = "revocado_en", nullable = false)
    private Instant revocadoEn = Instant.now();

    @Column(length = 60)
    private String motivo;

    public TokenRevocado(String jti, UUID usuarioId, Instant expiraEn, String motivo) {
        this.jti = jti;
        this.usuarioId = usuarioId;
        this.expiraEn = expiraEn;
        this.motivo = motivo;
    }
}
