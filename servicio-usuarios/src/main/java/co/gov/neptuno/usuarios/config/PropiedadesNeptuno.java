package co.gov.neptuno.usuarios.config;

import java.time.Duration;
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
    }

    @Getter
    @Setter
    public static class DatosIniciales {
        private boolean activo = true;
        private String administradorCorreo = "laura.restrepo@neptuno.gov.co";
        private String administradorClave = "Neptuno*2026";
    }
}
