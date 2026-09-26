package co.gov.neptuno.usuarios.seguridad;

import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

/** Identifica al usuario que ejecuta la acción, para la bitácora y las reglas de negocio. */
public final class ActorActual {

    private ActorActual() {
    }

    public static UUID id(Jwt token) {
        if (token == null || token.getSubject() == null) {
            return null;
        }
        try {
            return UUID.fromString(token.getSubject());
        } catch (IllegalArgumentException excepcion) {
            return null;
        }
    }
}
