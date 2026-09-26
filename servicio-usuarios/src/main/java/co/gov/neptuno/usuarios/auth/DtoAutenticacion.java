package co.gov.neptuno.usuarios.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contratos del inicio y cierre de sesión (HU-001, HU-002). */
public final class DtoAutenticacion {

    private DtoAutenticacion() {
    }

    public record PeticionLogin(
            @NotBlank(message = "El correo institucional es obligatorio")
            @Email(message = "El correo no tiene un formato válido")
            String correo,

            @NotBlank(message = "La contraseña es obligatoria")
            @Size(max = 72, message = "La contraseña no puede superar 72 caracteres")
            String clave) {
    }

    public record PeticionRefresco(
            @NotBlank(message = "El token de refresco es obligatorio")
            String refresco) {
    }

    public record TokenDto(String token, Instant expiraEn) {
    }

    /** Datos de la sesión que el frontend muestra en el encabezado (HU-001). */
    public record Sesion(
            UUID id,
            String nombre,
            String correo,
            String area,
            String areaCodigo,
            String rolPrincipal,
            List<String> roles,
            List<String> permisos,
            String iniciales,
            Instant ultimoAcceso) {
    }

    public record RespuestaSesion(TokenDto acceso, TokenDto refresco, Sesion sesion) {
    }

    public record RespuestaRefresco(TokenDto acceso, TokenDto refresco) {
    }
}
