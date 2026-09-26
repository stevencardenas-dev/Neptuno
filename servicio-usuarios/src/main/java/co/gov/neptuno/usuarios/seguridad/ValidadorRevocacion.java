package co.gov.neptuno.usuarios.seguridad;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/** HU-002: un token revocado al cerrar sesión deja de ser válido de inmediato. */
@Component
public class ValidadorRevocacion implements OAuth2TokenValidator<Jwt> {

    private final RepositorioTokenRevocado revocados;

    public ValidadorRevocacion(RepositorioTokenRevocado revocados) {
        this.revocados = revocados;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        String identificador = token.getId();
        if (identificador != null && revocados.existsByJti(identificador)) {
            return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                    "token_revocado", "La sesión fue cerrada; inicia sesión nuevamente.", null));
        }
        return OAuth2TokenValidatorResult.success();
    }
}
