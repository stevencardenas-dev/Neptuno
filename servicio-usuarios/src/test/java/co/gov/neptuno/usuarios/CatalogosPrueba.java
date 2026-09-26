package co.gov.neptuno.usuarios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** HU-015 (tipos documentales), HU-016 (áreas) y HU-022 (entidades). */
class CatalogosPrueba extends PruebaBase {

    @Test
    @DisplayName("HU-016: crea, edita y desactiva áreas del organigrama")
    void administraAreas() throws Exception {
        String admin = tokenAdmin();
        String nombre = "Área Prueba " + UUID.randomUUID().toString().substring(0, 6);

        MvcResult creada = ejecutar(postJson("/api/usuarios/areas", Map.of(
                "nombre", nombre,
                "responsable", "Responsable de Prueba",
                "estado", "ACTIVO")), admin, 201);
        UUID areaId = UUID.fromString(json(creada).path("id").asText());
        assertThat(json(creada).path("codigo").asText()).startsWith("ARE-");

        Map<String, Object> edicion = new LinkedHashMap<>();
        edicion.put("nombre", nombre + " II");
        edicion.put("responsable", "Otro Responsable");
        edicion.put("estado", "ACTIVO");
        MvcResult editada = ejecutar(put("/api/usuarios/areas/" + areaId)
                .contentType(APPLICATION_JSON).content(cuerpo(edicion)), admin, 200);
        assertThat(json(editada).path("nombre").asText()).isEqualTo(nombre + " II");

        ejecutar(delete("/api/usuarios/areas/" + areaId), admin, 204);
        MvcResult desactivada = ejecutar(get("/api/usuarios/areas/" + areaId), admin, 200);
        assertThat(json(desactivada).path("estado").asText()).isEqualTo("INACTIVO");

        MvcResult activas = ejecutar(get("/api/usuarios/areas").param("soloActivas", "true"), admin, 200);
        for (JsonNode area : json(activas)) {
            assertThat(area.path("estado").asText()).isEqualTo("ACTIVO");
        }

        ejecutar(delete("/api/usuarios/areas/" + areaPorNombre(admin, "Subdirección Administrativa")), admin, 409);
    }

    @Test
    @DisplayName("HU-015: administra tipos documentales y los filtra por origen")
    void administraTiposDocumentales() throws Exception {
        String admin = tokenAdmin();
        String nombre = "Tipo Prueba " + UUID.randomUUID().toString().substring(0, 6);

        MvcResult creado = ejecutar(postJson("/api/usuarios/tipos-documentales", Map.of(
                "nombre", nombre,
                "prefijo", "TP",
                "origenes", List.of("RECIBIDO", "INTERNO"),
                "estado", "ACTIVO")), admin, 201);
        UUID tipoId = UUID.fromString(json(creado).path("id").asText());
        assertThat(json(creado).path("origenes")).hasSize(2);

        MvcResult porOrigen = ejecutar(get("/api/usuarios/tipos-documentales")
                .param("origen", "RECIBIDO").param("soloActivos", "true"), admin, 200);
        boolean encontrado = false;
        for (JsonNode tipo : json(porOrigen)) {
            if (tipo.path("nombre").asText().equals(nombre)) {
                encontrado = true;
            }
        }
        assertThat(encontrado).isTrue();

        ejecutar(postJson("/api/usuarios/tipos-documentales", Map.of(
                "nombre", nombre + " duplicado", "origenes", List.of())), admin, 400);

        ejecutar(delete("/api/usuarios/tipos-documentales/" + tipoId), admin, 204);
        MvcResult desactivado = ejecutar(get("/api/usuarios/tipos-documentales/" + tipoId), admin, 200);
        assertThat(json(desactivado).path("estado").asText()).isEqualTo("INACTIVO");
    }

    @Test
    @DisplayName("HU-022: administra entidades por NIT y razón social, y las busca")
    void administraEntidades() throws Exception {
        String admin = tokenAdmin();
        String nit = "9" + UUID.randomUUID().toString().replaceAll("[^0-9]", "").substring(0, 8) + "-1";

        MvcResult creada = ejecutar(postJson("/api/usuarios/entidades", Map.of(
                "nit", nit,
                "razonSocial", "Proveedores de Prueba S.A.S.",
                "ciudad", "Cúcuta",
                "tipo", "Proveedor",
                "estado", "ACTIVO")), admin, 201);
        UUID entidadId = UUID.fromString(json(creada).path("id").asText());

        ejecutar(postJson("/api/usuarios/entidades", Map.of(
                "nit", nit,
                "razonSocial", "Duplicada S.A.S.")), admin, 409);

        MvcResult buscada = ejecutar(get("/api/usuarios/entidades").param("texto", nit.substring(1, 5)), admin, 200);
        boolean encontrada = false;
        for (JsonNode entidad : json(buscada)) {
            if (entidad.path("nit").asText().equals(nit)) {
                encontrada = true;
            }
        }
        assertThat(encontrada).isTrue();

        ejecutar(delete("/api/usuarios/entidades/" + entidadId), admin, 204);
        assertThat(json(ejecutar(get("/api/usuarios/entidades/" + entidadId), admin, 200)).path("estado").asText())
                .isEqualTo("INACTIVO");
    }

    @Test
    @DisplayName("Orígenes documentales del formato AAAAMMDD + X + CONSECUTIVO")
    void listaOrigenes() throws Exception {
        String admin = tokenAdmin();
        MvcResult origenes = ejecutar(get("/api/usuarios/catalogos/origenes"), admin, 200);
        JsonNode lista = json(origenes);
        assertThat(lista).hasSize(4);
        assertThat(lista.get(0).path("digito").asInt()).isEqualTo(1);
        assertThat(lista.get(2).path("etiqueta").asText()).isEqualTo("Recibido");
    }

    @Test
    @DisplayName("HU-013: administrar catálogos exige permiso y consultarlos no")
    void exigePermisoDeAdministracion() throws Exception {
        String tokenConsulta = tokenDeRol("CatalogoConsulta " + UUID.randomUUID().toString().substring(0, 6),
                List.of("catalogos:consultar"));

        mockMvc.perform(get("/api/usuarios/areas").header("Authorization", "Bearer " + tokenConsulta))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/usuarios/areas").header("Authorization", "Bearer " + tokenConsulta)
                        .contentType(APPLICATION_JSON)
                        .content(cuerpo(Map.of("nombre", "Área no permitida"))))
                .andExpect(status().isForbidden());
    }
}
