package co.gov.neptuno.usuarios.auth;

import co.gov.neptuno.usuarios.seguridad.ActorActual;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** HU-001 (iniciar sesión) y HU-002 (cerrar sesión). */
@RestController
@RequestMapping("/api/usuarios/auth")
@Tag(name = "Autenticación", description = "Inicio y cierre de sesión (HU-001, HU-002)")
public class ControladorAutenticacion {

    private final ServicioAutenticacion servicio;

    public ControladorAutenticacion(ServicioAutenticacion servicio) {
        this.servicio = servicio;
    }

    @PostMapping("/login")
    @Operation(summary = "Iniciar sesión", description = "Valida las credenciales y entrega el token de acceso con los roles y permisos del usuario.")
    public ResponseEntity<DtoAutenticacion.RespuestaSesion> iniciarSesion(@Valid @RequestBody DtoAutenticacion.PeticionLogin peticion,
                                                                          HttpServletRequest solicitud) {
        // Con server.forward-headers-strategy=native, getRemoteAddr ya refleja la IP del
        // cliente cuando la petición llega por el proxy de confianza (nginx); leer
        // X-Forwarded-For a mano permitía que cualquiera falsificara el origen en la bitácora.
        return ResponseEntity.ok(servicio.iniciarSesion(peticion, solicitud.getRemoteAddr()));
    }

    @PostMapping("/logout")
    @Operation(summary = "Cerrar sesión", description = "Revoca el token presentado y, si se envía, el token de refresco.")
    public ResponseEntity<Void> cerrarSesion(@AuthenticationPrincipal Jwt token,
                                             @RequestBody(required = false) DtoAutenticacion.PeticionRefresco peticion) {
        servicio.cerrarSesion(token, peticion == null ? null : peticion.refresco(), ActorActual.id(token));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/refrescar")
    @Operation(summary = "Renovar el acceso", description = "Emite un nuevo token de acceso a partir del token de refresco vigente.")
    public ResponseEntity<DtoAutenticacion.RespuestaRefresco> refrescar(@Valid @RequestBody DtoAutenticacion.PeticionRefresco peticion) {
        return ResponseEntity.ok(servicio.refrescar(peticion.refresco()));
    }

    @GetMapping("/sesion")
    @Operation(summary = "Consultar la sesión", description = "Devuelve el rol, el área y los permisos vigentes del usuario autenticado.")
    public ResponseEntity<DtoAutenticacion.Sesion> sesion(@AuthenticationPrincipal Jwt token) {
        return ResponseEntity.ok(servicio.sesionActual(ActorActual.id(token)));
    }
}
