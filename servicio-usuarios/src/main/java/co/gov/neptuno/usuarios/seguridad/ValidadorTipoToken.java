package co.gov.neptuno.usuarios.seguridad;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/** Evita que un token de refresco se use como token de acceso y viceversa. */
public class ValidadorTipoToken implements OAuth2TokenValidator<Jwt> {

    private final TipoToken esperado;

    public ValidadorTipoToken(TipoToken esperado) {
        this.esperado = esperado;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        String tipo = token.getClaimAsString("typ");
        if (esperado.name().equals(tipo)) {
            return OAuth2TokenValidatorResult.success();
        }
        return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                "tipo_token_invalido", "El token no es del tipo esperado para esta operación.", null));
    }
}
