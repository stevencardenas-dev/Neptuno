package co.gov.neptuno.usuarios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** HU-014: los demás microservicios resuelven rol y área del usuario por la API interna. */
class InternoPrueba extends PruebaBase {

    private static final String CLAVE_INTERNA = "clave-interna-de-pruebas";

    @Test
    @DisplayName("HU-014: la API interna exige la clave de servicios")
    void exigeClaveDeServicios() throws Exception {
        String admin = tokenAdmin();
        UUID usuarioId = UUID.fromString(json(ejecutar(get("/api/usuarios/auth/sesion"), admin, 200)).path("id").asText());

        mockMvc.perform(get("/api/usuarios/interno/usuarios/" + usuarioId + "/contexto-acceso"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/usuarios/interno/usuarios/" + usuarioId + "/contexto-acceso")
                        .header("X-Servicio-Clave", "clave-equivocada"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("HU-014: entrega el área, los roles y los permisos del usuario")
    void entregaContextoDeAcceso() throws Exception {
        String admin = tokenAdmin();
        UUID usuarioId = UUID.fromString(json(ejecutar(get("/api/usuarios/auth/sesion"), admin, 200)).path("id").asText());

        MvcResult resultado = mockMvc.perform(get("/api/usuarios/interno/usuarios/" + usuarioId + "/contexto-acceso")
                        .header("X-Servicio-Clave", CLAVE_INTERNA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.area").value("Subdirección Administrativa"))
                .andExpect(jsonPath("$.areaCodigo").value("ARE-01"))
                .andExpect(jsonPath("$.roles[0]").value("Administrador"))
                .andExpect(jsonPath("$.estado").value("ACTIVO"))
                .andReturn();

        JsonNode cuerpo = json(resultado);
        assertThat(cuerpo.path("permisos").toString()).contains("usuarios:crear").contains("catalogos:administrar");
    }

    @Test
    @DisplayName("HU-013/HU-014: verifica si el usuario tiene un permiso concreto")
    void verificaPermiso() throws Exception {
        String admin = tokenAdmin();
        UUID usuarioId = UUID.fromString(json(ejecutar(get("/api/usuarios/auth/sesion"), admin, 200)).path("id").asText());

        MvcResult permitido = mockMvc.perform(get("/api/usuarios/interno/usuarios/" + usuarioId + "/permisos/usuarios:crear")
                        .header("X-Servicio-Clave", CLAVE_INTERNA))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(json(permitido).path("permitido").asBoolean()).isTrue();

        MvcResult denegado = mockMvc.perform(get("/api/usuarios/interno/usuarios/" + usuarioId + "/permisos/flujo:firmar")
                        .header("X-Servicio-Clave", CLAVE_INTERNA))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(json(denegado).path("permitido").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("HU-014: resuelve varios contextos en una sola llamada")
    void entregaContextosPorLote() throws Exception {
        String admin = tokenAdmin();
        UUID usuarioId = UUID.fromString(json(ejecutar(get("/api/usuarios/auth/sesion"), admin, 200)).path("id").asText());

        MvcResult resultado = mockMvc.perform(get("/api/usuarios/interno/usuarios/contextos")
                        .param("ids", usuarioId.toString())
                        .header("X-Servicio-Clave", CLAVE_INTERNA))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(json(resultado)).hasSize(1);
        assertThat(json(resultado).get(0).path("id").asText()).isEqualTo(usuarioId.toString());
    }

    @Test
    @DisplayName("HU-014: un usuario inexistente responde 404")
    void usuarioInexistente() throws Exception {
        mockMvc.perform(get("/api/usuarios/interno/usuarios/" + UUID.randomUUID() + "/contexto-acceso")
                        .header("X-Servicio-Clave", CLAVE_INTERNA))
                .andExpect(status().isNotFound());
    }
}
