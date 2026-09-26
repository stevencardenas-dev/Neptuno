package co.gov.neptuno.usuarios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** HU-007…HU-011: roles y permisos. */
class RolesPrueba extends PruebaBase {

    @Test
    @DisplayName("HU-007: crea un rol con permisos y rechaza nombres duplicados")
    void crearRol() throws Exception {
        String admin = tokenAdmin();
        String nombre = "Rol Prueba " + UUID.randomUUID().toString().substring(0, 6);
        List<String> permisos = List.of(permisoPorCodigo(admin, "usuarios:consultar").toString(),
                permisoPorCodigo(admin, "roles:consultar").toString());

        MvcResult creado = ejecutar(postJson("/api/usuarios/roles", Map.of(
                "nombre", nombre,
                "descripcion", "Perfil de solo consulta",
                "tipo", "CONTROL",
                "permisos", permisos)), admin, 201);

        JsonNode cuerpo = json(creado);
        assertThat(cuerpo.path("permisos").asInt()).isEqualTo(2);
        assertThat(cuerpo.path("tipoEtiqueta").asText()).isEqualTo("Control");
        assertThat(cuerpo.path("usuarios").asLong()).isZero();

        ejecutar(postJson("/api/usuarios/roles", Map.of(
                "nombre", nombre,
                "descripcion", "Duplicado",
                "tipo", "CONTROL")), admin, 409);

        ejecutar(postJson("/api/usuarios/roles", Map.of("nombre", "", "tipo", "CONTROL")), admin, 400);
    }

    @Test
    @DisplayName("HU-008: edita nombre, descripción y tipo del rol")
    void editarRol() throws Exception {
        String admin = tokenAdmin();
        String nombre = "Rol Editable " + UUID.randomUUID().toString().substring(0, 6);
        UUID rolId = UUID.fromString(json(ejecutar(postJson("/api/usuarios/roles", Map.of(
                "nombre", nombre, "descripcion", "Inicial", "tipo", "OPERATIVO")), admin, 201)).path("id").asText());

        Map<String, Object> edicion = new LinkedHashMap<>();
        edicion.put("nombre", nombre + " II");
        edicion.put("descripcion", "Ajustado a la estructura de la organización");
        edicion.put("tipo", "APROBADOR");
        MvcResult editado = ejecutar(put("/api/usuarios/roles/" + rolId)
                .contentType(APPLICATION_JSON).content(cuerpo(edicion)), admin, 200);

        assertThat(json(editado).path("nombre").asText()).isEqualTo(nombre + " II");
        assertThat(json(editado).path("tipoEtiqueta").asText()).isEqualTo("Aprobador");
        assertThat(json(editado).path("descripcion").asText()).contains("estructura");
    }

    @Test
    @DisplayName("HU-011: asigna y quita permisos a un rol")
    void asignarPermisos() throws Exception {
        String admin = tokenAdmin();
        String nombre = "Rol Permisos " + UUID.randomUUID().toString().substring(0, 6);
        UUID rolId = UUID.fromString(json(ejecutar(postJson("/api/usuarios/roles", Map.of(
                "nombre", nombre, "descripcion", "Sin permisos", "tipo", "OPERATIVO")), admin, 201)).path("id").asText());

        List<String> permisos = List.of(
                permisoPorCodigo(admin, "usuarios:consultar").toString(),
                permisoPorCodigo(admin, "usuarios:crear").toString(),
                permisoPorCodigo(admin, "catalogos:administrar").toString());
        MvcResult asignado = ejecutar(put("/api/usuarios/roles/" + rolId + "/permisos")
                .contentType(APPLICATION_JSON).content(cuerpo(Map.of("permisos", permisos))), admin, 200);
        assertThat(json(asignado).path("permisos").asInt()).isEqualTo(3);

        MvcResult quitados = ejecutar(put("/api/usuarios/roles/" + rolId + "/permisos")
                .contentType(APPLICATION_JSON).content(cuerpo(Map.of("permisos", List.of()))), admin, 200);
        assertThat(json(quitados).path("permisos").asInt()).isZero();

        ejecutar(put("/api/usuarios/roles/" + rolId + "/permisos")
                .contentType(APPLICATION_JSON)
                .content(cuerpo(Map.of("permisos", List.of(UUID.randomUUID().toString())))), admin, 404);
    }

    @Test
    @DisplayName("HU-010: lista los roles con sus permisos, usuarios asignados y catálogo de permisos")
    void listarRoles() throws Exception {
        String admin = tokenAdmin();
        MvcResult listado = ejecutar(get("/api/usuarios/roles"), admin, 200);
        JsonNode roles = json(listado);

        JsonNode administrador = null;
        for (JsonNode rol : roles) {
            if (rol.path("nombre").asText().equals("Administrador")) {
                administrador = rol;
            }
        }
        assertThat(administrador).isNotNull();
        // HU-024: el Administrador recibe 24 de los 25 permisos; la radicación de
        // origen Recibido queda exclusiva del rol Radicador.
        assertThat(administrador.path("permisos").asInt()).isEqualTo(24);
        assertThat(administrador.path("usuarios").asLong()).isGreaterThanOrEqualTo(1);

        MvcResult usuariosDelRol = ejecutar(get("/api/usuarios/roles/"
                + rolPorNombre(admin, "Administrador") + "/usuarios"), admin, 200);
        assertThat(json(usuariosDelRol).get(0).path("nombre").asText()).isEqualTo("Laura Restrepo");

        MvcResult catalogo = ejecutar(get("/api/usuarios/permisos"), admin, 200);
        int total = 0;
        for (JsonNode grupo : json(catalogo)) {
            total += grupo.path("permisos").size();
        }
        assertThat(total).isEqualTo(25);
    }

    @Test
    @DisplayName("HU-024: solo el rol Radicador puede radicar documentos de origen Recibido")
    void soloElRolRadicadorRadicaRecibidos() throws Exception {
        String admin = tokenAdmin();
        Set<String> rolesConElPermiso = new LinkedHashSet<>();

        for (JsonNode rol : json(ejecutar(get("/api/usuarios/roles"), admin, 200))) {
            for (JsonNode permiso : rol.path("detallePermisos")) {
                if ("radicados:radicar-recibido".equals(permiso.path("codigo").asText())) {
                    rolesConElPermiso.add(rol.path("nombre").asText());
                }
            }
        }

        assertThat(rolesConElPermiso).containsExactly("Radicador");
    }

    @Test
    @DisplayName("HU-009: no elimina un rol con usuarios asignados y sí uno sin usuarios")
    void eliminarRol() throws Exception {
        String admin = tokenAdmin();

        ejecutar(delete("/api/usuarios/roles/" + rolPorNombre(admin, "Administrador")), admin, 409);

        String nombre = "Rol Desechable " + UUID.randomUUID().toString().substring(0, 6);
        UUID rolId = UUID.fromString(json(ejecutar(postJson("/api/usuarios/roles", Map.of(
                "nombre", nombre, "descripcion", "Se eliminará", "tipo", "OPERATIVO")), admin, 201)).path("id").asText());
        ejecutar(delete("/api/usuarios/roles/" + rolId), admin, 204);
        ejecutar(get("/api/usuarios/roles/" + rolId), admin, 404);
    }

    @Test
    @DisplayName("HU-010/HU-013: un rol sin permiso de roles recibe 403")
    void exigePermisoDeRoles() throws Exception {
        String token = tokenDeRol("SinRoles " + UUID.randomUUID().toString().substring(0, 6),
                List.of("usuarios:consultar"));
        mockMvc.perform(get("/api/usuarios/roles").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }
}
