package co.gov.neptuno.usuarios.seguridad;

import co.gov.neptuno.usuarios.comun.ErroresApi;
import co.gov.neptuno.usuarios.config.PropiedadesNeptuno;
import co.gov.neptuno.usuarios.roles.Rol;
import co.gov.neptuno.usuarios.usuarios.Usuario;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Emisión y control de los tokens del sistema.
 *
 * <p>El token de acceso lleva los roles y los permisos del usuario, de modo que cada
 * solicitud pueda validarse sin consultar la base de datos (HU-013). El token de
 * refresco solo identifica al usuario.</p>
 */
@Service
public class ServicioTokens {

    private static final Logger registro = LoggerFactory.getLogger(ServicioTokens.class);

    /** Token emitido con su fecha de expiración. */
    public record Token(String valor, Instant expiraEn, TipoToken tipo) {
    }

    private final JwtEncoder codificador;
    private final JwtDecoder decodificadorRefresco;
    private final RepositorioTokenRevocado revocados;
    private final PropiedadesNeptuno propiedades;

    public ServicioTokens(JwtEncoder codificador,
                          @Qualifier("decodificadorRefresco") JwtDecoder decodificadorRefresco,
                          RepositorioTokenRevocado revocados,
                          PropiedadesNeptuno propiedades) {
        this.codificador = codificador;
        this.decodificadorRefresco = decodificadorRefresco;
        this.revocados = revocados;
        this.propiedades = propiedades;
    }

    public Token emitirAcceso(Usuario usuario, List<String> permisos) {
        return emitir(usuario, permisos, TipoToken.ACCESO, propiedades.getJwt().getVigenciaAcceso());
    }

    public Token emitirRefresco(Usuario usuario) {
        return emitir(usuario, List.of(), TipoToken.REFRESCO, propiedades.getJwt().getVigenciaRefresco());
    }

    private Token emitir(Usuario usuario, List<String> permisos, TipoToken tipo, Duration vigencia) {
        Instant ahora = Instant.now();
        Instant expira = ahora.plus(vigencia);
        List<String> roles = usuario.getRoles().stream().map(Rol::getNombre).sorted().toList();
        String rolPrincipal = roles.stream()
                .filter(nombre -> nombre.equalsIgnoreCase("Administrador"))
                .findFirst()
                .orElse(roles.isEmpty() ? "Sin rol" : roles.get(0));

        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer(propiedades.getJwt().getEmisor())
                .issuedAt(ahora)
                .expiresAt(expira)
                .id(UUID.randomUUID().toString())
                .subject(usuario.getId().toString())
                .claim("typ", tipo.name())
                .claim("correo", usuario.getCorreo())
                .claim("nombre", usuario.getNombre())
                .claim("areaId", usuario.getArea().getId().toString())
                .claim("area", usuario.getArea().getNombre())
                .claim("roles", roles)
                .claim("rolPrincipal", rolPrincipal);
        if (tipo == TipoToken.ACCESO) {
            claims.claim("permisos", permisos);
        }

        JwsHeader cabecera = JwsHeader.with(MacAlgorithm.HS256).build();
        String valor = codificador.encode(JwtEncoderParameters.from(cabecera, claims.build())).getTokenValue();
        return new Token(valor, expira, tipo);
    }

    /** Valida un token de refresco y devuelve su contenido. */
    @Transactional(readOnly = true)
    public Jwt validarRefresco(String valor) {
        try {
            return decodificadorRefresco.decode(valor);
        } catch (JwtException | IllegalArgumentException excepcion) {
            throw new ErroresApi.CredencialesInvalidas("El token de refresco no es válido o ya expiró.");
        }
    }

    /** HU-002: invalida el token presentado hasta su expiración natural. */
    @Transactional
    public void revocar(Jwt token, String motivo) {
        if (token == null || token.getId() == null) {
            return;
        }
        UUID usuarioId = token.getSubject() == null ? null : UUID.fromString(token.getSubject());
        revocados.save(new TokenRevocado(token.getId(), usuarioId, token.getExpiresAt(), motivo));
    }

    /** Limpieza diaria de tokens revocados ya expirados. */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void purgarRevocadosExpirados() {
        int eliminados = revocados.purgarExpirados(Instant.now());
        if (eliminados > 0) {
            registro.info("Se purgaron {} tokens revocados expirados.", eliminados);
        }
    }
}
