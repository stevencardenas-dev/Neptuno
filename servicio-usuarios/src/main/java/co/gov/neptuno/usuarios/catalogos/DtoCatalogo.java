package co.gov.neptuno.usuarios.catalogos;

import co.gov.neptuno.usuarios.comun.EstadoCatalogo;
import co.gov.neptuno.usuarios.comun.OrigenDocumento;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Contratos de los catálogos maestros: áreas (HU-016), tipos documentales (HU-015) y entidades (HU-022). */
public final class DtoCatalogo {

    private DtoCatalogo() {
    }

    /* ------------------------------- Áreas ------------------------------- */

    public record PeticionArea(
            @Size(max = 20, message = "El código no puede superar 20 caracteres")
            String codigo,

            @NotBlank(message = "El nombre del área es obligatorio")
            @Size(max = 120, message = "El nombre no puede superar 120 caracteres")
            String nombre,

            @Size(max = 120, message = "El responsable no puede superar 120 caracteres")
            String responsable,

            EstadoCatalogo estado) {
    }

    public record RespuestaArea(
            UUID id,
            String codigo,
            String nombre,
            String responsable,
            EstadoCatalogo estado,
            String estadoEtiqueta,
            long usuarios,
            Instant creadoEn,
            Instant actualizadoEn) {
    }

    /* -------------------------- Tipos documentales -------------------------- */

    public record PeticionTipoDocumental(
            @NotBlank(message = "El nombre del tipo documental es obligatorio")
            @Size(max = 120, message = "El nombre no puede superar 120 caracteres")
            String nombre,

            @Size(max = 10, message = "El prefijo no puede superar 10 caracteres")
            String prefijo,

            @NotNull(message = "Debes indicar al menos un origen")
            Set<OrigenDocumento> origenes,

            EstadoCatalogo estado) {
    }

    public record RespuestaTipoDocumental(
            UUID id,
            String nombre,
            String prefijo,
            Set<OrigenDocumento> origenes,
            EstadoCatalogo estado,
            String estadoEtiqueta,
            Instant creadoEn,
            Instant actualizadoEn) {
    }

    /* ----------------------------- Entidades ------------------------------ */

    public record PeticionEntidad(
            @NotBlank(message = "El NIT es obligatorio")
            @Size(max = 30, message = "El NIT no puede superar 30 caracteres")
            String nit,

            @NotBlank(message = "La razón social es obligatoria")
            @Size(max = 160, message = "La razón social no puede superar 160 caracteres")
            String razonSocial,

            @Size(max = 80, message = "La ciudad no puede superar 80 caracteres")
            String ciudad,

            @Size(max = 40, message = "El tipo no puede superar 40 caracteres")
            String tipo,

            EstadoCatalogo estado) {
    }

    public record RespuestaEntidad(
            UUID id,
            String nit,
            String razonSocial,
            String ciudad,
            String tipo,
            EstadoCatalogo estado,
            String estadoEtiqueta,
            Instant creadoEn,
            Instant actualizadoEn) {
    }

    /* ------------------------------- Orígenes ------------------------------- */

    /** Orígenes del formato de radicado AAAAMMDD + X + CONSECUTIVO. */
    public record RespuestaOrigen(int digito, String nombre, String etiqueta) {
    }
}
