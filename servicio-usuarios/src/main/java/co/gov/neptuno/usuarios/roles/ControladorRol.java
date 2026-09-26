package co.gov.neptuno.usuarios.roles;

import co.gov.neptuno.usuarios.seguridad.ActorActual;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
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
import org.springframework.web.bind.annotation.RestController;

/** HU-007…HU-011: administración de roles y permisos. */
@RestController
@RequestMapping("/api/usuarios")
@Tag(name = "Roles y permisos", description = "Crear, editar, eliminar roles y asignar permisos (HU-007…HU-011)")
public class ControladorRol {

    private final ServicioRol servicio;

    public ControladorRol(ServicioRol servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('roles:consultar')")
    @Operation(summary = "Consultar roles", description = "Lista los roles con su número de permisos y de usuarios asignados (HU-010).")
    public ResponseEntity<List<DtoRol.Respuesta>> listar() {
        return ResponseEntity.ok(servicio.listar());
    }

    @GetMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('roles:consultar')")
    @Operation(summary = "Consultar un rol", description = "Detalle del rol con sus permisos (HU-010).")
    public ResponseEntity<DtoRol.Respuesta> obtener(@PathVariable UUID id) {
        return ResponseEntity.ok(servicio.obtener(id));
    }

    @GetMapping("/roles/{id}/usuarios")
    @PreAuthorize("hasAuthority('roles:consultar')")
    @Operation(summary = "Usuarios del rol", description = "Quién tiene este nivel de acceso (HU-010).")
    public ResponseEntity<List<DtoRol.UsuarioDelRol>> usuariosDelRol(@PathVariable UUID id) {
        return ResponseEntity.ok(servicio.usuariosDelRol(id));
    }

    @PostMapping("/roles")
    @PreAuthorize("hasAuthority('roles:crear')")
    @Operation(summary = "Crear rol", description = "Agrupa los permisos de un perfil de la organización (HU-007).")
    public ResponseEntity<DtoRol.Respuesta> crear(@Valid @RequestBody DtoRol.PeticionCrear peticion,
                                                  @AuthenticationPrincipal Jwt token) {
        DtoRol.Respuesta creado = servicio.crear(peticion, ActorActual.id(token));
        return ResponseEntity.created(URI.create("/api/usuarios/roles/" + creado.id())).body(creado);
    }

    @PutMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('roles:editar')")
    @Operation(summary = "Editar rol", description = "Actualiza el nombre, la descripción y el tipo del rol (HU-008).")
    public ResponseEntity<DtoRol.Respuesta> editar(@PathVariable UUID id,
                                                   @Valid @RequestBody DtoRol.PeticionEditar peticion,
                                                   @AuthenticationPrincipal Jwt token) {
        return ResponseEntity.ok(servicio.editar(id, peticion, ActorActual.id(token)));
    }

    @DeleteMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('roles:eliminar')")
    @Operation(summary = "Eliminar rol", description = "Solo se elimina un rol sin usuarios asignados (HU-009).")
    public ResponseEntity<Void> eliminar(@PathVariable UUID id, @AuthenticationPrincipal Jwt token) {
        servicio.eliminar(id, ActorActual.id(token));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/roles/{id}/permisos")
    @PreAuthorize("hasAuthority('roles:asignar-permisos')")
    @Operation(summary = "Asignar permisos al rol", description = "Define con precisión lo que puede hacer cada perfil (HU-011).")
    public ResponseEntity<DtoRol.Respuesta> asignarPermisos(@PathVariable UUID id,
                                                            @Valid @RequestBody DtoRol.PeticionPermisos peticion,
                                                            @AuthenticationPrincipal Jwt token) {
        return ResponseEntity.ok(servicio.asignarPermisos(id, peticion, ActorActual.id(token)));
    }

    @GetMapping("/permisos")
    @PreAuthorize("hasAuthority('roles:consultar')")
    @Operation(summary = "Catálogo de permisos", description = "Permisos sobre funcionalidades agrupados por módulo (HU-011).")
    public ResponseEntity<List<DtoRol.GrupoPermisos>> catalogoPermisos() {
        return ResponseEntity.ok(servicio.catalogoPermisos());
    }
}
