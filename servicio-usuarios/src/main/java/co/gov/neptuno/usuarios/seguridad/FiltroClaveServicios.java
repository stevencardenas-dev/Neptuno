package co.gov.neptuno.usuarios.seguridad;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Autentica las llamadas entre microservicios mediante la cabecera
 * {@code X-Servicio-Clave}. Si la clave no coincide, la solicitud queda anónima y la
 * autorización de {@code /interno/**} la rechaza (HU-014).
 */
public class FiltroClaveServicios extends OncePerRequestFilter {

    public static final String CABECERA = "X-Servicio-Clave";
    public static final String AUTORIDAD_SERVICIO = "SERVICIO_INTERNO";

    private final byte[] claveEsperada;

    public FiltroClaveServicios(String clave) {
        this.claveEsperada = clave == null ? new byte[0] : clave.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest solicitud, HttpServletResponse respuesta, FilterChain cadena)
            throws ServletException, IOException {
        String recibida = solicitud.getHeader(CABECERA);
        if (recibida != null && claveEsperada.length > 0
                && MessageDigest.isEqual(claveEsperada, recibida.getBytes(StandardCharsets.UTF_8))) {
            var autenticacion = new UsernamePasswordAuthenticationToken(
                    "servicio-interno", null, List.of(new SimpleGrantedAuthority(AUTORIDAD_SERVICIO)));
            SecurityContextHolder.getContext().setAuthentication(autenticacion);
        }
        cadena.doFilter(solicitud, respuesta);
    }
}
