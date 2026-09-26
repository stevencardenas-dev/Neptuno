package co.gov.neptuno.usuarios;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Utilidades compartidas por las pruebas de integración del servicio. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class PruebaBase {

    protected static final String CORREO_ADMIN = "laura.restrepo@neptuno.gov.co";
    protected static final String CLAVE_ADMIN = "Neptuno*2026";
    protected static final String CLAVE_NUEVA = "Clave*Prueba2026";

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper mapeador;

    /* --------------------------- Peticiones de apoyo --------------------------- */

    protected MvcResult ejecutar(MockHttpServletRequestBuilder peticion, String token, int estadoEsperado) throws Exception {
        if (token != null) {
            peticion.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(peticion)
                .andExpect(status().is(estadoEsperado))
                .andReturn();
    }

    protected JsonNode json(MvcResult resultado) throws Exception {
        String contenido = resultado.getResponse().getContentAsString();
        return contenido.isBlank() ? mapeador.createObjectNode() : mapeador.readTree(contenido);
    }

    protected String cuerpo(Object valor) throws Exception {
        return mapeador.writeValueAsString(valor);
    }

    protected MockHttpServletRequestBuilder postJson(String ruta, Object cuerpo) throws Exception {
        return post(ruta).contentType(APPLICATION_JSON).content(cuerpo(cuerpo));
    }

    /* --------------------------------- Sesión ---------------------------------- */

    protected String iniciarSesion(String correo, String clave) throws Exception {
        MvcResult resultado = mockMvc.perform(postJson("/api/usuarios/auth/login", Map.of("correo", correo, "clave", clave)))
                .andExpect(status().isOk())
                .andReturn();
        return json(resultado).path("acceso").path("token").asText();
    }

    protected String tokenAdmin() throws Exception {
        return iniciarSesion(CORREO_ADMIN, CLAVE_ADMIN);
    }

    /* -------------------------------- Catálogos -------------------------------- */

    protected UUID areaPorNombre(String token, String nombre) throws Exception {
        JsonNode areas = json(ejecutar(get("/api/usuarios/areas"), token, 200));
        for (JsonNode area : areas) {
            if (area.path("nombre").asText().equalsIgnoreCase(nombre)) {
                return UUID.fromString(area.path("id").asText());
            }
        }
        throw new IllegalStateException("No existe el área " + nombre);
    }

    protected UUID rolPorNombre(String token, String nombre) throws Exception {
        JsonNode roles = json(ejecutar(get("/api/usuarios/roles"), token, 200));
        for (JsonNode rol : roles) {
            if (rol.path("nombre").asText().equalsIgnoreCase(nombre)) {
                return UUID.fromString(rol.path("id").asText());
            }
        }
        throw new IllegalStateException("No existe el rol " + nombre);
    }

    protected UUID permisoPorCodigo(String token, String codigo) throws Exception {
        JsonNode grupos = json(ejecutar(get("/api/usuarios/permisos"), token, 200));
        for (JsonNode grupo : grupos) {
            for (JsonNode permiso : grupo.path("permisos")) {
                if (permiso.path("codigo").asText().equals(codigo)) {
                    return UUID.fromString(permiso.path("id").asText());
                }
            }
        }
        throw new IllegalStateException("No existe el permiso " + codigo);
    }

    /* ---------------------------- Datos de las pruebas ---------------------------- */

    protected String correoUnico() {
        return "prueba." + UUID.randomUUID().toString().substring(0, 8) + "@neptuno.gov.co";
    }

    /** Crea un usuario y devuelve su identificador. */
    protected UUID crearUsuario(String token, String nombre, String correo, List<UUID> roles) throws Exception {
        Map<String, Object> peticion = new LinkedHashMap<>();
        peticion.put("nombre", nombre);
        peticion.put("correo", correo);
        peticion.put("clave", CLAVE_NUEVA);
        peticion.put("areaId", areaPorNombre(token, "Gerencia General").toString());
        peticion.put("estado", "ACTIVO");
        if (roles != null) {
            peticion.put("roles", roles.stream().map(UUID::toString).toList());
        }
        MvcResult resultado = ejecutar(postJson("/api/usuarios/usuarios", peticion), token, 201);
        return UUID.fromString(json(resultado).path("id").asText());
    }

    /**
     * Crea un rol con los permisos indicados, un usuario con ese rol y devuelve el token
     * de acceso de ese usuario; sirve para comprobar el control de acceso (HU-013).
     */
    protected String tokenDeRol(String nombreRol, List<String> codigosPermisos) throws Exception {
        String admin = tokenAdmin();
        List<String> idsPermisos = new ArrayList<>();
        for (String codigo : codigosPermisos) {
            idsPermisos.add(permisoPorCodigo(admin, codigo).toString());
        }
        MvcResult rol = ejecutar(postJson("/api/usuarios/roles", Map.of(
                "nombre", nombreRol,
                "descripcion", "Rol creado por las pruebas automatizadas",
                "tipo", "OPERATIVO",
                "permisos", idsPermisos)), admin, 201);
        UUID rolId = UUID.fromString(json(rol).path("id").asText());

        String correo = correoUnico();
        crearUsuario(admin, "Usuario de prueba", correo, List.of(rolId));
        return iniciarSesion(correo, CLAVE_NUEVA);
    }
}
