package co.gov.neptuno.usuarios.interno;

import co.gov.neptuno.usuarios.usuarios.DtoUsuario;
import co.gov.neptuno.usuarios.usuarios.ServicioUsuario;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * API interna para los demás microservicios (se autentica con la cabecera
 * {@code X-Servicio-Clave}, no con JWT de usuario).
 *
 * <p>HU-014: ms-documental consulta el rol y el área del usuario para limitar la
 * visibilidad de los documentos; ms-workflow-bpm y ms-audit-infra resuelven aquí los
 * permisos y el nombre del responsable de cada tarea.</p>
 */
@RestController
@RequestMapping("/api/usuarios/interno")
@Tag(name = "API interna", description = "Consumo entre microservicios (HU-014)")
public class ControladorInterno {

    private final ServicioUsuario usuarios;

    public ControladorInterno(ServicioUsuario usuarios) {
        this.usuarios = usuarios;
    }

    @GetMapping("/usuarios/{id}/contexto-acceso")
    @Operation(summary = "Contexto de acceso", description = "Rol, área y permisos del usuario para filtrar documentos (HU-014).")
    public ResponseEntity<DtoUsuario.ContextoAcceso> contextoAcceso(@PathVariable UUID id) {
        return ResponseEntity.ok(usuarios.contextoAcceso(id));
    }

    @GetMapping("/usuarios/contextos")
    @Operation(summary = "Contextos por lote", description = "Contexto de acceso de varios usuarios en una sola llamada.")
    public ResponseEntity<List<DtoUsuario.ContextoAcceso>> contextos(@RequestParam List<UUID> ids) {
        return ResponseEntity.ok(usuarios.contextosAcceso(ids));
    }

    @GetMapping("/usuarios/{id}/permisos/{codigo}")
    @Operation(summary = "Verificar un permiso", description = "Confirma si el usuario tiene un permiso concreto (HU-013).")
    public ResponseEntity<Map<String, Object>> verificarPermiso(@PathVariable UUID id, @PathVariable String codigo) {
        DtoUsuario.ContextoAcceso contexto = usuarios.contextoAcceso(id);
        boolean permitido = contexto.permisos().contains(codigo);
        return ResponseEntity.ok(Map.of(
                "usuarioId", contexto.id(),
                "permiso", codigo,
                "permitido", permitido,
                "roles", contexto.roles(),
                "area", contexto.area()));
    }
}
