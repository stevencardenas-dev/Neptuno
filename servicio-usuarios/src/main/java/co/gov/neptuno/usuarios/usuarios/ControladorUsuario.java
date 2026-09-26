package co.gov.neptuno.usuarios.usuarios;

import co.gov.neptuno.usuarios.comun.ErroresApi;
import co.gov.neptuno.usuarios.comun.EstadoUsuario;
import co.gov.neptuno.usuarios.comun.RespuestaPagina;
import co.gov.neptuno.usuarios.seguridad.ActorActual;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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

/** HU-003…HU-006 y HU-012: administración de usuarios. */
@RestController
@RequestMapping("/api/usuarios/usuarios")
@Tag(name = "Usuarios", description = "Crear, editar, dar de baja, consultar y asignar roles (HU-003…HU-006, HU-012)")
public class ControladorUsuario {

    private static final int TAMANO_MAXIMO = 100;

    private final ServicioUsuario servicio;

    public ControladorUsuario(ServicioUsuario servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('usuarios:consultar')")
    @Operation(summary = "Listar y buscar usuarios", description = "Filtra por nombre o correo, rol, estado y área (HU-006).")
    public ResponseEntity<RespuestaPagina<DtoUsuario.Respuesta>> listar(
            @RequestParam(required = false) String texto,
            @RequestParam(required = false) UUID rolId,
            @RequestParam(required = false) EstadoUsuario estado,
            @RequestParam(required = false) UUID areaId,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "10") int tamano) {
        return ResponseEntity.ok(servicio.buscar(texto, rolId, estado, areaId, paginacion(pagina, tamano)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('usuarios:consultar')")
    @Operation(summary = "Consultar un usuario", description = "Detalle del usuario con su área y sus roles (HU-006).")
    public ResponseEntity<DtoUsuario.Respuesta> obtener(@PathVariable UUID id) {
        return ResponseEntity.ok(servicio.obtener(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('usuarios:crear')")
    @Operation(summary = "Crear usuario", description = "Registra un usuario con nombre, correo, área, estado y clave inicial (HU-003).")
    public ResponseEntity<DtoUsuario.Respuesta> crear(@Valid @RequestBody DtoUsuario.PeticionCrear peticion,
                                                      @AuthenticationPrincipal Jwt token) {
        DtoUsuario.Respuesta creado = servicio.crear(peticion, ActorActual.id(token));
        return ResponseEntity.created(URI.create("/api/usuarios/usuarios/" + creado.id())).body(creado);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('usuarios:editar')")
    @Operation(summary = "Editar usuario", description = "Actualiza nombre, correo, área y estado del usuario (HU-004).")
    public ResponseEntity<DtoUsuario.Respuesta> editar(@PathVariable UUID id,
                                                       @Valid @RequestBody DtoUsuario.PeticionEditar peticion,
                                                       @AuthenticationPrincipal Jwt token) {
        return ResponseEntity.ok(servicio.editar(id, peticion, ActorActual.id(token)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('usuarios:eliminar')")
    @Operation(summary = "Dar de baja al usuario", description = "Baja lógica: revoca el acceso sin perder el historial (HU-005).")
    public ResponseEntity<Void> darDeBaja(@PathVariable UUID id, @AuthenticationPrincipal Jwt token) {
        servicio.darDeBaja(id, ActorActual.id(token));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/roles")
    @PreAuthorize("hasAuthority('usuarios:asignar-roles')")
    @Operation(summary = "Asignar roles", description = "Asigna o quita uno o varios roles al usuario (HU-012).")
    public ResponseEntity<DtoUsuario.Respuesta> asignarRoles(@PathVariable UUID id,
                                                             @Valid @RequestBody DtoUsuario.PeticionRoles peticion,
                                                             @AuthenticationPrincipal Jwt token) {
        return ResponseEntity.ok(servicio.asignarRoles(id, peticion, ActorActual.id(token)));
    }

    @PutMapping("/{id}/clave")
    @PreAuthorize("hasAuthority('usuarios:editar')")
    @Operation(summary = "Cambiar contraseña", description = "Establece una nueva contraseña para el usuario.")
    public ResponseEntity<Void> cambiarClave(@PathVariable UUID id,
                                             @Valid @RequestBody DtoUsuario.PeticionClave peticion,
                                             @AuthenticationPrincipal Jwt token) {
        servicio.cambiarClave(id, peticion.clave(), ActorActual.id(token));
        return ResponseEntity.noContent().build();
    }

    private PageRequest paginacion(int pagina, int tamano) {
        if (pagina < 0) {
            throw new ErroresApi.ReglaInvalida("El número de página no puede ser negativo.");
        }
        if (tamano < 1 || tamano > TAMANO_MAXIMO) {
            throw new ErroresApi.ReglaInvalida("El tamaño de página debe estar entre 1 y " + TAMANO_MAXIMO + ".");
        }
        return PageRequest.of(pagina, tamano, Sort.by(Sort.Direction.ASC, "nombre"));
    }
}
