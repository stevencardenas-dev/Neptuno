package co.gov.neptuno.usuarios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** HU-001 y HU-002: inicio y cierre de sesión. */
class AutenticacionPrueba extends PruebaBase {

    @Test
    @DisplayName("HU-001: inicia sesión con credenciales válidas y entrega roles y permisos")
    void iniciaSesionConCredencialesValidas() throws Exception {
        MvcResult resultado = mockMvc.perform(postJson("/api/usuarios/auth/login",
                        Map.of("correo", CORREO_ADMIN, "clave", CLAVE_ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.acceso.token").isNotEmpty())
                .andExpect(jsonPath("$.refresco.token").isNotEmpty())
                .andExpect(jsonPath("$.sesion.rolPrincipal").value("Administrador"))
                .andExpect(jsonPath("$.sesion.iniciales").value("LR"))
                .andExpect(jsonPath("$.sesion.area").value("Subdirección Administrativa"))
                .andReturn();

        JsonNode cuerpo = json(resultado);
        List<String> permisos = new ArrayList<>();
        cuerpo.path("sesion").path("permisos").forEach(permiso -> permisos.add(permiso.asText()));
        assertThat(permisos).contains("usuarios:crear", "roles:asignar-permisos", "catalogos:administrar");
    }

    @Test
    @DisplayName("HU-001: rechaza credenciales incorrectas y campos vacíos")
    void rechazaCredencialesIncorrectas() throws Exception {
        mockMvc.perform(postJson("/api/usuarios/auth/login", Map.of("correo", CORREO_ADMIN, "clave", "clave-mala")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CREDENCIALES_INVALIDAS"));

        mockMvc.perform(postJson("/api/usuarios/auth/login",
                        Map.of("correo", "nadie@neptuno.gov.co", "clave", CLAVE_ADMIN)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(postJson("/api/usuarios/auth/login", Map.of("correo", "", "clave", "")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));
    }

    @Test
    @DisplayName("HU-001: la sesión solo se consulta con un token válido")
    void consultaSesionConToken() throws Exception {
        mockMvc.perform(get("/api/usuarios/auth/sesion"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));

        mockMvc.perform(get("/api/usuarios/auth/sesion").header("Authorization", "Bearer " + tokenAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correo").value(CORREO_ADMIN))
                .andExpect(jsonPath("$.roles[0]").value("Administrador"));
    }

    @Test
    @DisplayName("HU-002: cerrar sesión revoca el token entregado")
    void cerrarSesionRevocaElToken() throws Exception {
        String token = tokenAdmin();
        mockMvc.perform(post("/api/usuarios/auth/logout").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/usuarios/auth/sesion").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("HU-002: el refresco rota el token y solo puede usarse una vez")
    void refrescoRotaElToken() throws Exception {
        MvcResult sesion = mockMvc.perform(postJson("/api/usuarios/auth/login",
                        Map.of("correo", CORREO_ADMIN, "clave", CLAVE_ADMIN)))
                .andExpect(status().isOk())
                .andReturn();
        String refresco = json(sesion).path("refresco").path("token").asText();

        MvcResult renovado = mockMvc.perform(postJson("/api/usuarios/auth/refrescar", Map.of("refresco", refresco)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.acceso.token").isNotEmpty())
                .andReturn();
        String nuevoAcceso = json(renovado).path("acceso").path("token").asText();

        mockMvc.perform(get("/api/usuarios/auth/sesion").header("Authorization", "Bearer " + nuevoAcceso))
                .andExpect(status().isOk());

        mockMvc.perform(postJson("/api/usuarios/auth/refrescar", Map.of("refresco", refresco)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("HU-001/HU-005: un usuario dado de baja no puede iniciar sesión")
    void usuarioDadoDeBajaNoIniciaSesion() throws Exception {
        String admin = tokenAdmin();
        String correo = correoUnico();
        UUID usuarioId = crearUsuario(admin, "Usuario Temporal", correo, List.of(rolPorNombre(admin, "Radicador")));
        assertThat(iniciarSesion(correo, CLAVE_NUEVA)).isNotBlank();

        ejecutar(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .delete("/api/usuarios/usuarios/" + usuarioId), admin, 204);

        mockMvc.perform(postJson("/api/usuarios/auth/login", Map.of("correo", correo, "clave", CLAVE_NUEVA)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("inactiva")));
    }

    @Test
    @DisplayName("HU-003/HU-004: la contraseña se cambia con permiso de edición")
    void cambiaClaveDeUsuario() throws Exception {
        String admin = tokenAdmin();
        String correo = correoUnico();
        UUID usuarioId = crearUsuario(admin, "Usuario Clave", correo, List.of(rolPorNombre(admin, "Auditor")));

        Map<String, Object> peticion = new LinkedHashMap<>();
        peticion.put("clave", "Otra*Clave2026");
        ejecutar(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .put("/api/usuarios/usuarios/" + usuarioId + "/clave")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(cuerpo(peticion)), admin, 204);

        assertThat(iniciarSesion(correo, "Otra*Clave2026")).isNotBlank();
    }
}
