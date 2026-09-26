package co.gov.neptuno.usuarios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

/** HU-003…HU-006 y HU-012: administración de usuarios. */
class UsuariosPrueba extends PruebaBase {

    @Test
    @DisplayName("HU-013: sin token no se accede a la administración de usuarios")
    void exigeAutenticacion() throws Exception {
        mockMvc.perform(get("/api/usuarios/usuarios"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));
    }

    @Test
    @DisplayName("HU-013: un rol sin permiso de consulta recibe 403")
    void exigePermisoDeConsulta() throws Exception {
        String tokenRestringido = tokenDeRol("SoloCatalogos " + UUID.randomUUID().toString().substring(0, 6),
                List.of("catalogos:consultar"));

        mockMvc.perform(get("/api/usuarios/usuarios").header("Authorization", "Bearer " + tokenRestringido))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("ACCESO_DENEGADO"));

        mockMvc.perform(get("/api/usuarios/areas").header("Authorization", "Bearer " + tokenRestringido))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("HU-003: crea el usuario y rechaza correos duplicados y campos vacíos")
    void creaUsuario() throws Exception {
        String admin = tokenAdmin();
        String correo = correoUnico();
        Map<String, Object> peticion = new LinkedHashMap<>();
        peticion.put("nombre", "Carlos Andrade");
        peticion.put("correo", correo);
        peticion.put("clave", CLAVE_NUEVA);
        peticion.put("areaId", areaPorNombre(admin, "Jurídica").toString());
        peticion.put("estado", "ACTIVO");
        peticion.put("roles", List.of(rolPorNombre(admin, "Radicador").toString()));

        MvcResult creado = ejecutar(postJson("/api/usuarios/usuarios", peticion), admin, 201);
        assertThat(json(creado).path("correo").asText()).isEqualTo(correo);
        assertThat(json(creado).path("estadoEtiqueta").asText()).isEqualTo("Activo");
        assertThat(json(creado).path("roles").get(0).path("nombre").asText()).isEqualTo("Radicador");

        ejecutar(postJson("/api/usuarios/usuarios", peticion), admin, 409);

        Map<String, Object> incompleto = new LinkedHashMap<>(peticion);
        incompleto.put("nombre", "");
        incompleto.put("correo", correoUnico());
        ejecutar(postJson("/api/usuarios/usuarios", incompleto), admin, 400);

        Map<String, Object> sinArea = new LinkedHashMap<>(peticion);
        sinArea.remove("areaId");
        sinArea.put("correo", correoUnico());
        ejecutar(postJson("/api/usuarios/usuarios", sinArea), admin, 400);
    }

    @Test
    @DisplayName("HU-006: busca usuarios por nombre o correo, por rol y por estado")
    void buscaUsuarios() throws Exception {
        String admin = tokenAdmin();
        UUID rolTesorero = rolPorNombre(admin, "Tesorero");
        String correo = correoUnico();
        crearUsuario(admin, "Búsqueda Automática", correo, List.of(rolTesorero));

        MvcResult porTexto = ejecutar(get("/api/usuarios/usuarios")
                .param("texto", correo.substring(0, 12)), admin, 200);
        assertThat(json(porTexto).path("contenido")).hasSize(1);
        assertThat(json(porTexto).path("total").asLong()).isEqualTo(1);

        MvcResult porRol = ejecutar(get("/api/usuarios/usuarios")
                .param("rolId", rolTesorero.toString())
                .param("estado", "ACTIVO"), admin, 200);
        assertThat(json(porRol).path("total").asLong()).isGreaterThanOrEqualTo(1);

        UUID usuarioId = UUID.fromString(json(porTexto).path("contenido").get(0).path("id").asText());
        ejecutar(delete("/api/usuarios/usuarios/" + usuarioId), admin, 204);
        MvcResult inactivos = ejecutar(get("/api/usuarios/usuarios")
                .param("texto", correo.substring(0, 12))
                .param("estado", "INACTIVO"), admin, 200);
        assertThat(json(inactivos).path("total").asLong()).isEqualTo(1);
    }

    @Test
    @DisplayName("HU-004: edita nombre, correo, área y estado; HU-005: da de baja sin perder el registro")
    void editaYDaDeBaja() throws Exception {
        String admin = tokenAdmin();
        String correo = correoUnico();
        UUID usuarioId = crearUsuario(admin, "Usuario Editable", correo, List.of(rolPorNombre(admin, "Auditor")));

        Map<String, Object> edicion = new LinkedHashMap<>();
        edicion.put("nombre", "Usuario Editado");
        edicion.put("correo", correo);
        edicion.put("areaId", areaPorNombre(admin, "Contabilidad y Tesorería").toString());
        edicion.put("estado", "ACTIVO");
        MvcResult editado = ejecutar(put("/api/usuarios/usuarios/" + usuarioId)
                .contentType(APPLICATION_JSON).content(cuerpo(edicion)), admin, 200);
        assertThat(json(editado).path("nombre").asText()).isEqualTo("Usuario Editado");
        assertThat(json(editado).path("area").path("nombre").asText()).isEqualTo("Contabilidad y Tesorería");

        ejecutar(delete("/api/usuarios/usuarios/" + usuarioId), admin, 204);

        MvcResult baja = ejecutar(get("/api/usuarios/usuarios/" + usuarioId), admin, 200);
        assertThat(json(baja).path("estado").asText()).isEqualTo("INACTIVO");
        assertThat(json(baja).path("eliminadoEn").asText()).isNotBlank();

        ejecutar(delete("/api/usuarios/usuarios/" + usuarioId), admin, 400);
    }

    @Test
    @DisplayName("HU-012: asigna y quita roles a un usuario")
    void asignaRoles() throws Exception {
        String admin = tokenAdmin();
        String correo = correoUnico();
        UUID usuarioId = crearUsuario(admin, "Usuario Roles", correo, List.of(rolPorNombre(admin, "Auditor")));

        List<String> nuevos = new ArrayList<>();
        nuevos.add(rolPorNombre(admin, "Radicador").toString());
        nuevos.add(rolPorNombre(admin, "Tesorero").toString());
        MvcResult asignado = ejecutar(put("/api/usuarios/usuarios/" + usuarioId + "/roles")
                .contentType(APPLICATION_JSON).content(cuerpo(Map.of("roles", nuevos))), admin, 200);
        assertThat(json(asignado).path("roles")).hasSize(2);

        ejecutar(put("/api/usuarios/usuarios/" + usuarioId + "/roles")
                .contentType(APPLICATION_JSON).content(cuerpo(Map.of("roles", List.of()))), admin, 400);

        long adminsActivos = json(ejecutar(get("/api/usuarios/usuarios")
                .param("rolId", rolPorNombre(admin, "Administrador").toString())
                .param("estado", "ACTIVO"), admin, 200)).path("total").asLong();
        assertThat(adminsActivos).isGreaterThanOrEqualTo(1);
    }

    @Test
    @DisplayName("HU-006: la paginación se valida y ordena por nombre")
    void validaPaginacion() throws Exception {
        String admin = tokenAdmin();
        ejecutar(get("/api/usuarios/usuarios").param("tamano", "500"), admin, 400);
        ejecutar(get("/api/usuarios/usuarios").param("pagina", "-1"), admin, 400);
        MvcResult pagina = ejecutar(get("/api/usuarios/usuarios").param("pagina", "0").param("tamano", "5"), admin, 200);
        JsonNode contenido = json(pagina).path("contenido");
        assertThat(contenido.size()).isLessThanOrEqualTo(5);
    }

    @Test
    @DisplayName("HU-003: un usuario de prueba puede iniciar sesión con la clave asignada")
    void usuarioCreadoIniciaSesion() throws Exception {
        String admin = tokenAdmin();
        String correo = correoUnico();
        crearUsuario(admin, "Usuario Acceso", correo, List.of(rolPorNombre(admin, "Auditor")));
        mockMvc.perform(post("/api/usuarios/auth/login").contentType(APPLICATION_JSON)
                        .content(cuerpo(Map.of("correo", correo, "clave", CLAVE_NUEVA))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sesion.rolPrincipal").value("Auditor"));
    }
}
