package co.gov.neptuno.usuarios.roles;

import co.gov.neptuno.usuarios.comun.TipoRol;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contratos de entrada y salida de roles y permisos (HU-007…HU-011). */
public final class DtoRol {

    private DtoRol() {
    }

    /** HU-007: nombre, descripción, tipo y permisos iniciales. */
    public record PeticionCrear(
            @NotBlank(message = "El nombre del rol es obligatorio")
            @Size(max = 80, message = "El nombre no puede superar 80 caracteres")
            String nombre,

            @Size(max = 300, message = "La descripción no puede superar 300 caracteres")
            String descripcion,

            TipoRol tipo,

            List<UUID> permisos) {
    }

    /** HU-008: se editan nombre, descripción y tipo. */
    public record PeticionEditar(
            @NotBlank(message = "El nombre del rol es obligatorio")
            @Size(max = 80, message = "El nombre no puede superar 80 caracteres")
            String nombre,

            @Size(max = 300, message = "La descripción no puede superar 300 caracteres")
            String descripcion,

            TipoRol tipo) {
    }

    /** HU-011: conjunto de permisos que puede ejecutar el rol (puede quedar vacío). */
    public record PeticionPermisos(
            @NotNull(message = "Debes indicar los permisos del rol")
            List<UUID> permisos) {
    }

    public record PermisoResumen(UUID id, String codigo, String nombre, String modulo, String descripcion) {
    }

    public record GrupoPermisos(String modulo, List<PermisoResumen> permisos) {
    }

    /** HU-010: el listado informa cuántos permisos y cuántos usuarios tiene cada rol. */
    public record Respuesta(
            UUID id,
            String nombre,
            String descripcion,
            TipoRol tipo,
            String tipoEtiqueta,
            int permisos,
            long usuarios,
            List<PermisoResumen> detallePermisos,
            Instant creadoEn,
            Instant actualizadoEn) {
    }

    /** Usuario asignado a un rol (tarjeta "Usuarios con este rol" de HU-010). */
    public record UsuarioDelRol(UUID id, String nombre, String correo, String area, String estado) {
    }
}
