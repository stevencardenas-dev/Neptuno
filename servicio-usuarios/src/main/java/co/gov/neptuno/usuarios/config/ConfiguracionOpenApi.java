package co.gov.neptuno.usuarios.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Documentación interactiva del API en /api/usuarios/documentacion. */
@Configuration
public class ConfiguracionOpenApi {

    @Bean
    OpenAPI documentacion() {
        return new OpenAPI()
                .info(new Info()
                        .title("Neptuno · servicio-usuarios (ms-auth-catalogs)")
                        .version("0.1.0")
                        .description("""
                                Autenticación, seguridad y datos maestros del sistema de gestión documental Neptuno.
                                Cubre HU-001…HU-016 y HU-022 del backlog, y expone el contexto de rol y área
                                que los demás microservicios usan para restringir el acceso (HU-013, HU-014).
                                """))
                .components(new Components().addSecuritySchemes("bearer", new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Token de acceso entregado por /api/usuarios/auth/login")))
                .addSecurityItem(new SecurityRequirement().addList("bearer"));
    }
}
