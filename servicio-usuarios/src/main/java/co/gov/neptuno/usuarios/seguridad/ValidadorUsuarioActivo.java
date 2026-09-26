package co.gov.neptuno.usuarios.seguridad;

import co.gov.neptuno.usuarios.comun.EstadoUsuario;
import co.gov.neptuno.usuarios.usuarios.RepositorioUsuario;
import java.util.UUID;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * HU-013: los permisos se revalidan en cada solicitud. Si el usuario fue dado de baja
 * (HU-005) o eliminado, sus tokens dejan de servir aunque no hayan expirado.
 */
@Component
public class ValidadorUsuarioActivo implements OAuth2TokenValidator<Jwt> {

    private final RepositorioUsuario usuarios;

    public ValidadorUsuarioActivo(RepositorioUsuario usuarios) {
        this.usuarios = usuarios;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        String sujeto = token.getSubject();
        if (sujeto == null) {
            return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                    "token_invalido", "El token no identifica a un usuario.", null));
        }
        return usuarios.findById(UUID.fromString(sujeto))
                .filter(usuario -> usuario.getEstado() == EstadoUsuario.ACTIVO)
                .map(usuario -> OAuth2TokenValidatorResult.success())
                .orElseGet(() -> OAuth2TokenValidatorResult.failure(new OAuth2Error(
                        "usuario_inactivo", "El usuario no está activo en el sistema.", null)));
    }
}
