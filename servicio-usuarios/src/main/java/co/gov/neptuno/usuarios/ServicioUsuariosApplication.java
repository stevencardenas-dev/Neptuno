package co.gov.neptuno.usuarios;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Neptuno · servicio-usuarios (ms-auth-catalogs).
 *
 * <p>Bounded context IAM: autenticación (HU-001, HU-002), control de acceso basado
 * en roles (HU-013), administración de usuarios (HU-003…HU-006, HU-012), roles y
 * permisos (HU-007…HU-011) y catálogos maestros (HU-015, HU-016, HU-022).</p>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
// Las tareas programadas (purga de tokens revocados y publicación de eventos) no
// deben depender de que la mensajería esté activa.
@EnableScheduling
public class ServicioUsuariosApplication {

    public static void main(String[] args) {
        SpringApplication.run(ServicioUsuariosApplication.class, args);
    }
}
