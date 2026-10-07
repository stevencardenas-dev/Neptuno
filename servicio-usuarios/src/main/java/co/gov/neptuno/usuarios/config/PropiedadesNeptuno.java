package co.gov.neptuno.usuarios.config;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Parámetros del microservicio declarados bajo el prefijo {@code neptuno.*}. */
@Getter
@ConfigurationProperties(prefix = "neptuno")
public class PropiedadesNeptuno {

    private final Jwt jwt = new Jwt();
    private final Servicios servicios = new Servicios();
    private final Eventos eventos = new Eventos();
    private final DatosIniciales datosIniciales = new DatosIniciales();
    private final Cors cors = new Cors();

    @Getter
    @Setter
    public static class Jwt {
        /** Clave compartida para firmar los JWT (HS256); mínimo 32 caracteres. */
        private String secreto;
        private String emisor = "neptuno-ms-auth-catalogs";
        private Duration vigenciaAcceso = Duration.ofMinutes(30);
        private Duration vigenciaRefresco = Duration.ofHours(12);
    }

    @Getter
    @Setter
    public static class Servicios {
        /** Clave compartida para llamadas máquina a máquina en /interno/**. */
        private String claveInterna;
    }

    @Getter
    @Setter
    public static class Eventos {
        private boolean publicar = true;
        private String exchange = "neptuno.eventos";
        private String colaAuditoria = "audit.infrastructure";
        private String routingKey = "audit.evento";
        /** Cada cuánto se envían al broker los eventos pendientes (patrón outbox). */
        private Duration intervaloPublicacion = Duration.ofSeconds(5);
    }

    @Getter
    @Setter
    public static class DatosIniciales {
        private boolean activo = true;
        private String administradorNombre = "Administrador del sistema";
        private String administradorCorreo;
        private String administradorClave;
    }

    @Getter
    @Setter
    public static class Cors {
        /**
         * Orígenes con permiso para llamar al API desde el navegador. En contenedores
         * nginx sirve la SPA y el API en el mismo origen, así que solo hace falta para
         * desarrollo (Vite en :5173 apuntando directo al servicio).
         */
        private List<String> origenes = new ArrayList<>(List.of("http://localhost:5173"));
    }
}
