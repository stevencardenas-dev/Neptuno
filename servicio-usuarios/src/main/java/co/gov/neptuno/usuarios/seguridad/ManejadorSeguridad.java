package co.gov.neptuno.usuarios.seguridad;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/** Devuelve errores JSON cuando falta el token (401) o el permiso (403) — HU-013. */
@Component
public class ManejadorSeguridad implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper mapeador;

    public ManejadorSeguridad(ObjectMapper mapeador) {
        this.mapeador = mapeador;
    }

    @Override
    public void commence(HttpServletRequest solicitud, HttpServletResponse respuesta, AuthenticationException excepcion)
            throws IOException {
        escribir(respuesta, HttpServletResponse.SC_UNAUTHORIZED, "NO_AUTENTICADO",
                "Debes iniciar sesión para acceder a esta funcionalidad.");
    }

    @Override
    public void handle(HttpServletRequest solicitud, HttpServletResponse respuesta, AccessDeniedException excepcion)
            throws IOException {
        escribir(respuesta, HttpServletResponse.SC_FORBIDDEN, "ACCESO_DENEGADO",
                "El usuario no tiene el permiso requerido para esta funcionalidad.");
    }

    private void escribir(HttpServletResponse respuesta, int estado, String codigo, String mensaje) throws IOException {
        respuesta.setStatus(estado);
        respuesta.setContentType(MediaType.APPLICATION_JSON_VALUE);
        respuesta.setCharacterEncoding("UTF-8");
        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("codigo", codigo);
        cuerpo.put("mensaje", mensaje);
        cuerpo.put("momento", Instant.now().toString());
        mapeador.writeValue(respuesta.getOutputStream(), cuerpo);
    }
}
