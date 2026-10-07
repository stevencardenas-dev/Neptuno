package co.gov.neptuno.usuarios;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Endurecimiento de la sesión: enumeración de cuentas, permisos vigentes y errores uniformes. */
class SeguridadSesionPrueba extends PruebaBase {

    @Test
    @DisplayName("HU-001: una cuenta inactiva con clave errada responde igual que una inexistente")
    void cuentaInactivaNoSeRevelaSinClave() throws Exception {
        String admin = tokenAdmin();
        String correo = correoUnico();
        UUID usuarioId = crearUsuario(admin, "Usuario Oculto", correo, List.of(rolPorNombre(admin, "Radicador")));
        ejecutar(delete("/api/usuarios/usuarios/" + usuarioId), admin, 204);

        mockMvc.perform(postJson("/api/usuarios/auth/login", Map.of("correo", correo, "clave", "clave-equivocada")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CREDENCIALES_INVALIDAS"));
    }

    @Test
    @DisplayName("HU-013: al cambiar los roles, el token de acceso anterior deja de servir y el refresco trae los nuevos permisos")
    void cambioDeRolesInvalidaElTokenDeAcceso() throws Exception {
        String admin = tokenAdmin();
        String correo = correoUnico();
        UUID usuarioId = crearUsuario(admin, "Usuario Cambiante", correo, List.of(rolPorNombre(admin, "Auditor")));

        JsonNode sesion = json(mockMvc.perform(postJson("/api/usuarios/auth/login",
                        Map.of("correo", correo, "clave", CLAVE_NUEVA)))
                .andExpect(status().isOk())
                .andReturn());
        String acceso = sesion.path("acceso").path("token").asText();
        String refresco = sesion.path("refresco").path("token").asText();
        ejecutar(get("/api/usuarios/auth/sesion"), acceso, 200);

        // El iat del JWT tiene precisión de segundos: se espera para que el cambio sea posterior.
        Thread.sleep(1100);
        ejecutar(put("/api/usuarios/usuarios/" + usuarioId + "/roles")
                .contentType(MediaType.APPLICATION_JSON)
                .content(cuerpo(Map.of("roles", List.of(rolPorNombre(admin, "Radicador"))))), admin, 200);

        ejecutar(get("/api/usuarios/auth/sesion"), acceso, 401);

        String renovado = json(mockMvc.perform(postJson("/api/usuarios/auth/refrescar", Map.of("refresco", refresco)))
                .andExpect(status().isOk())
                .andReturn()).path("acceso").path("token").asText();
        mockMvc.perform(get("/api/usuarios/auth/sesion").header("Authorization", "Bearer " + renovado))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rolPrincipal").value("Radicador"));
    }

    @Test
    @DisplayName("Un identificador mal formado responde 400 con el formato de error del servicio")
    void identificadorMalFormado() throws Exception {
        mockMvc.perform(get("/api/usuarios/usuarios/no-es-un-uuid").header("Authorization", "Bearer " + tokenAdmin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"));
    }
}
