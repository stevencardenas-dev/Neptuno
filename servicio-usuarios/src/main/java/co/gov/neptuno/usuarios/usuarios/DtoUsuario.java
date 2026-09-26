package co.gov.neptuno.usuarios.usuarios;

import co.gov.neptuno.usuarios.comun.EstadoUsuario;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contratos de entrada y salida de la administración de usuarios (HU-003…HU-006, HU-012). */
public final class DtoUsuario {

    private DtoUsuario() {
    }

    /** HU-003: nombre, correo, área, estado y clave inicial. */
    public record PeticionCrear(
            @NotBlank(message = "El nombre completo es obligatorio")
            @Size(max = 120, message = "El nombre no puede superar 120 caracteres")
            String nombre,

            @NotBlank(message = "El correo institucional es obligatorio")
            @Email(message = "El correo no tiene un formato válido")
            @Size(max = 160, message = "El correo no puede superar 160 caracteres")
            String correo,

            @NotBlank(message = "La contraseña es obligatoria")
            @Size(min = 10, max = 72, message = "La contraseña debe tener entre 10 y 72 caracteres")
            String clave,

            @NotNull(message = "El área es obligatoria")
            UUID areaId,

            EstadoUsuario estado,

            List<UUID> roles) {
    }

    /** HU-004: se editan nombre, correo, área y estado. */
    public record PeticionEditar(
            @NotBlank(message = "El nombre completo es obligatorio")
            @Size(max = 120, message = "El nombre no puede superar 120 caracteres")
            String nombre,

            @NotBlank(message = "El correo institucional es obligatorio")
            @Email(message = "El correo no tiene un formato válido")
            @Size(max = 160, message = "El correo no puede superar 160 caracteres")
            String correo,

            @NotNull(message = "El área es obligatoria")
            UUID areaId,

            EstadoUsuario estado) {
    }

    /** HU-012: un usuario debe conservar al menos un rol. */
    public record PeticionRoles(
            @NotNull(message = "Debes indicar los roles del usuario")
            @Size(min = 1, message = "El usuario debe tener al menos un rol")
            List<UUID> roles) {
    }

    /** Cambio de contraseña (fuera del alcance de las HU, requerido por la vista de acceso). */
    public record PeticionClave(
            @NotBlank(message = "La contraseña es obligatoria")
            @Size(min = 10, max = 72, message = "La contraseña debe tener entre 10 y 72 caracteres")
            String clave) {
    }

    public record AreaResumen(UUID id, String codigo, String nombre) {
    }

    public record RolResumen(UUID id, String nombre, String tipo) {
    }

    /** HU-006: respuesta del listado y del detalle de usuario. */
    public record Respuesta(
            UUID id,
            String nombre,
            String correo,
            AreaResumen area,
            EstadoUsuario estado,
            String estadoEtiqueta,
            List<RolResumen> roles,
            Instant ultimoAcceso,
            Instant creadoEn,
            Instant actualizadoEn,
            Instant eliminadoEn) {
    }

    /**
     * HU-014: contexto de acceso del usuario (rol y área) que los demás microservicios
     * consultan para filtrar la visibilidad de documentos.
     */
    public record ContextoAcceso(
            UUID id,
            String nombre,
            String correo,
            EstadoUsuario estado,
            UUID areaId,
            String area,
            String areaCodigo,
            List<String> roles,
            String rolPrincipal,
            List<String> permisos) {
    }
}
