package co.gov.neptuno.usuarios.seguridad;

import co.gov.neptuno.usuarios.comun.EstadoUsuario;
import co.gov.neptuno.usuarios.usuarios.RepositorioUsuario;
import co.gov.neptuno.usuarios.usuarios.Usuario;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * HU-013: los permisos se revalidan en cada solicitud. Si el usuario fue dado de baja
 * (HU-005) o eliminado, sus tokens dejan de servir aunque no hayan expirado. Y si sus
 * roles o permisos cambiaron después de emitido un token de acceso, ese token se
 * rechaza para que el cliente lo renueve con los permisos vigentes.
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
        Usuario usuario = usuarios.findById(UUID.fromString(sujeto))
                .filter(encontrado -> encontrado.getEstado() == EstadoUsuario.ACTIVO)
                .orElse(null);
        if (usuario == null) {
            return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                    "usuario_inactivo", "El usuario no está activo en el sistema.", null));
        }
        if (permisosDesactualizados(token, usuario)) {
            return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                    "permisos_desactualizados", "Los permisos del usuario cambiaron; renueva el token.", null));
        }
        return OAuth2TokenValidatorResult.success();
    }

    private boolean permisosDesactualizados(Jwt token, Usuario usuario) {
        Instant cambio = usuario.getPermisosActualizadosEn();
        Instant emitido = token.getIssuedAt();
        return TipoToken.ACCESO.name().equals(token.getClaimAsString("typ"))
                && cambio != null && emitido != null && emitido.isBefore(cambio);
    }
}
