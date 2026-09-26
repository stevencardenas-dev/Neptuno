package co.gov.neptuno.usuarios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MvcResult;

/**
 * HU-005/HU-012: el sistema nunca se queda sin un administrador activo. La clase deja
 * el contexto sucio a propósito para que las demás pruebas trabajen con una base limpia.
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class UltimoAdministradorPrueba extends PruebaBase {

    @Test
    @DisplayName("HU-005: no se puede dar de baja al último administrador activo")
    void protegeAlUltimoAdministrador() throws Exception {
        String admin = tokenAdmin();
        String correo = correoUnico();
        UUID segundoAdmin = crearUsuario(admin, "Administrador Temporal", correo,
                List.of(rolPorNombre(admin, "Administrador")));

        String tokenSegundo = iniciarSesion(correo, CLAVE_NUEVA);
        UUID idLaura = UUID.fromString(json(ejecutar(get("/api/usuarios/auth/sesion"), admin, 200)).path("id").asText());

        ejecutar(delete("/api/usuarios/usuarios/" + idLaura), tokenSegundo, 204);

        MvcResult adminsActivos = ejecutar(get("/api/usuarios/usuarios")
                .param("rolId", rolPorNombre(tokenSegundo, "Administrador").toString())
                .param("estado", "ACTIVO"), tokenSegundo, 200);
        assertThat(json(adminsActivos).path("total").asLong()).isEqualTo(1);

        ejecutar(delete("/api/usuarios/usuarios/" + segundoAdmin), tokenSegundo, 400);
        ejecutar(put("/api/usuarios/usuarios/" + segundoAdmin + "/roles")
                .contentType(APPLICATION_JSON)
                .content(cuerpo(Map.of("roles", List.of(
                        rolPorNombre(tokenSegundo, "Auditor").toString())))), tokenSegundo, 409);
    }
}
