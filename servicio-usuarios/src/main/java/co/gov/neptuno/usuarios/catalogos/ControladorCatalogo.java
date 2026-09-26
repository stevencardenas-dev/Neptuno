package co.gov.neptuno.usuarios.catalogos;

import co.gov.neptuno.usuarios.comun.OrigenDocumento;
import co.gov.neptuno.usuarios.seguridad.ActorActual;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Catálogos maestros: áreas (HU-016), tipos documentales (HU-015) y entidades (HU-022). */
@RestController
@RequestMapping("/api/usuarios")
@Tag(name = "Catálogos maestros", description = "Áreas, tipos documentales y entidades (HU-015, HU-016, HU-022)")
public class ControladorCatalogo {

    private final ServicioArea areas;
    private final ServicioTipoDocumental tipos;
    private final ServicioEntidad entidades;

    public ControladorCatalogo(ServicioArea areas, ServicioTipoDocumental tipos, ServicioEntidad entidades) {
        this.areas = areas;
        this.tipos = tipos;
        this.entidades = entidades;
    }

    /* --------------------------------- Áreas --------------------------------- */

    @GetMapping("/areas")
    @PreAuthorize("hasAuthority('catalogos:consultar')")
    @Operation(summary = "Listar áreas", description = "Áreas de la organización con su responsable y número de usuarios (HU-016).")
    public ResponseEntity<List<DtoCatalogo.RespuestaArea>> listarAreas(
            @RequestParam(required = false) Boolean soloActivas) {
        return ResponseEntity.ok(areas.listar(soloActivas));
    }

    @GetMapping("/areas/{id}")
    @PreAuthorize("hasAuthority('catalogos:consultar')")
    public ResponseEntity<DtoCatalogo.RespuestaArea> obtenerArea(@PathVariable UUID id) {
        return ResponseEntity.ok(areas.obtener(id));
    }

    @PostMapping("/areas")
    @PreAuthorize("hasAuthority('catalogos:administrar')")
    @Operation(summary = "Crear área", description = "Crea un área de la organización (HU-016).")
    public ResponseEntity<DtoCatalogo.RespuestaArea> crearArea(@Valid @RequestBody DtoCatalogo.PeticionArea peticion,
                                                               @AuthenticationPrincipal Jwt token) {
        DtoCatalogo.RespuestaArea creada = areas.crear(peticion, ActorActual.id(token));
        return ResponseEntity.created(URI.create("/api/usuarios/areas/" + creada.id())).body(creada);
    }

    @PutMapping("/areas/{id}")
    @PreAuthorize("hasAuthority('catalogos:administrar')")
    @Operation(summary = "Editar área", description = "Actualiza nombre, código, responsable y estado del área (HU-016).")
    public ResponseEntity<DtoCatalogo.RespuestaArea> editarArea(@PathVariable UUID id,
                                                                @Valid @RequestBody DtoCatalogo.PeticionArea peticion,
                                                                @AuthenticationPrincipal Jwt token) {
        return ResponseEntity.ok(areas.editar(id, peticion, ActorActual.id(token)));
    }

    @DeleteMapping("/areas/{id}")
    @PreAuthorize("hasAuthority('catalogos:administrar')")
    @Operation(summary = "Desactivar área", description = "Desactiva el área sin eliminar su historial; falla si tiene usuarios asignados (HU-016).")
    public ResponseEntity<Void> desactivarArea(@PathVariable UUID id, @AuthenticationPrincipal Jwt token) {
        areas.desactivar(id, ActorActual.id(token));
        return ResponseEntity.noContent().build();
    }

    /* --------------------------- Tipos documentales --------------------------- */

    @GetMapping("/tipos-documentales")
    @PreAuthorize("hasAuthority('catalogos:consultar')")
    @Operation(summary = "Listar tipos documentales", description = "Tipos documentales disponibles por origen (HU-015).")
    public ResponseEntity<List<DtoCatalogo.RespuestaTipoDocumental>> listarTipos(
            @RequestParam(required = false) Boolean soloActivos,
            @RequestParam(required = false) OrigenDocumento origen) {
        return ResponseEntity.ok(tipos.listar(soloActivos, origen));
    }

    @GetMapping("/tipos-documentales/{id}")
    @PreAuthorize("hasAuthority('catalogos:consultar')")
    public ResponseEntity<DtoCatalogo.RespuestaTipoDocumental> obtenerTipo(@PathVariable UUID id) {
        return ResponseEntity.ok(tipos.obtener(id));
    }

    @PostMapping("/tipos-documentales")
    @PreAuthorize("hasAuthority('catalogos:administrar')")
    @Operation(summary = "Crear tipo documental", description = "Clasifica los radicados por tipo documental (HU-015).")
    public ResponseEntity<DtoCatalogo.RespuestaTipoDocumental> crearTipo(
            @Valid @RequestBody DtoCatalogo.PeticionTipoDocumental peticion,
            @AuthenticationPrincipal Jwt token) {
        DtoCatalogo.RespuestaTipoDocumental creado = tipos.crear(peticion, ActorActual.id(token));
        return ResponseEntity.created(URI.create("/api/usuarios/tipos-documentales/" + creado.id())).body(creado);
    }

    @PutMapping("/tipos-documentales/{id}")
    @PreAuthorize("hasAuthority('catalogos:administrar')")
    @Operation(summary = "Editar tipo documental", description = "Actualiza nombre, prefijo, orígenes y estado (HU-015).")
    public ResponseEntity<DtoCatalogo.RespuestaTipoDocumental> editarTipo(
            @PathVariable UUID id,
            @Valid @RequestBody DtoCatalogo.PeticionTipoDocumental peticion,
            @AuthenticationPrincipal Jwt token) {
        return ResponseEntity.ok(tipos.editar(id, peticion, ActorActual.id(token)));
    }

    @DeleteMapping("/tipos-documentales/{id}")
    @PreAuthorize("hasAuthority('catalogos:administrar')")
    @Operation(summary = "Desactivar tipo documental", description = "Lo retira de la operación conservando los radicados históricos (HU-015).")
    public ResponseEntity<Void> desactivarTipo(@PathVariable UUID id, @AuthenticationPrincipal Jwt token) {
        tipos.desactivar(id, ActorActual.id(token));
        return ResponseEntity.noContent().build();
    }

    /* ------------------------------- Entidades ------------------------------- */

    @GetMapping("/entidades")
    @PreAuthorize("hasAuthority('catalogos:consultar')")
    @Operation(summary = "Listar entidades", description = "Entidades por NIT y razón social, filtrables por texto (HU-022).")
    public ResponseEntity<List<DtoCatalogo.RespuestaEntidad>> listarEntidades(
            @RequestParam(required = false) String texto,
            @RequestParam(required = false) Boolean soloActivas) {
        return ResponseEntity.ok(entidades.listar(texto, soloActivas));
    }

    @GetMapping("/entidades/{id}")
    @PreAuthorize("hasAuthority('catalogos:consultar')")
    public ResponseEntity<DtoCatalogo.RespuestaEntidad> obtenerEntidad(@PathVariable UUID id) {
        return ResponseEntity.ok(entidades.obtener(id));
    }

    @PostMapping("/entidades")
    @PreAuthorize("hasAuthority('catalogos:administrar')")
    @Operation(summary = "Crear entidad", description = "Registra una entidad para radicar Recibidos o generar Externos (HU-022).")
    public ResponseEntity<DtoCatalogo.RespuestaEntidad> crearEntidad(
            @Valid @RequestBody DtoCatalogo.PeticionEntidad peticion,
            @AuthenticationPrincipal Jwt token) {
        DtoCatalogo.RespuestaEntidad creada = entidades.crear(peticion, ActorActual.id(token));
        return ResponseEntity.created(URI.create("/api/usuarios/entidades/" + creada.id())).body(creada);
    }

    @PutMapping("/entidades/{id}")
    @PreAuthorize("hasAuthority('catalogos:administrar')")
    @Operation(summary = "Editar entidad", description = "Actualiza el NIT, la razón social y el estado de la entidad (HU-022).")
    public ResponseEntity<DtoCatalogo.RespuestaEntidad> editarEntidad(
            @PathVariable UUID id,
            @Valid @RequestBody DtoCatalogo.PeticionEntidad peticion,
            @AuthenticationPrincipal Jwt token) {
        return ResponseEntity.ok(entidades.editar(id, peticion, ActorActual.id(token)));
    }

    @DeleteMapping("/entidades/{id}")
    @PreAuthorize("hasAuthority('catalogos:administrar')")
    @Operation(summary = "Desactivar entidad", description = "Retira la entidad del catálogo sin borrar su historial (HU-022).")
    public ResponseEntity<Void> desactivarEntidad(@PathVariable UUID id, @AuthenticationPrincipal Jwt token) {
        entidades.desactivar(id, ActorActual.id(token));
        return ResponseEntity.noContent().build();
    }

    /* ------------------------------- Orígenes ------------------------------- */

    @GetMapping("/catalogos/origenes")
    @PreAuthorize("hasAuthority('catalogos:consultar')")
    @Operation(summary = "Orígenes documentales", description = "Dígitos del formato de radicado AAAAMMDD + X + CONSECUTIVO.")
    public ResponseEntity<List<DtoCatalogo.RespuestaOrigen>> listarOrigenes() {
        return ResponseEntity.ok(Arrays.stream(OrigenDocumento.values())
                .map(origen -> new DtoCatalogo.RespuestaOrigen(origen.digito(), origen.name(), origen.etiqueta()))
                .toList());
    }
}
