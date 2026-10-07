package co.gov.neptuno.usuarios.auth;

import co.gov.neptuno.usuarios.auditoria.PublicadorEventos;
import co.gov.neptuno.usuarios.comun.ErroresApi;
import co.gov.neptuno.usuarios.seguridad.ServicioTokens;
import co.gov.neptuno.usuarios.usuarios.RepositorioUsuario;
import co.gov.neptuno.usuarios.usuarios.ServicioUsuario;
import co.gov.neptuno.usuarios.usuarios.Usuario;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Inicio y cierre de sesión.
 *
 * <ul>
 *   <li>HU-001 Iniciar sesión: credenciales válidas, cuenta activa y emisión de JWT con
 *       los roles y permisos del usuario.</li>
 *   <li>HU-002 Cerrar sesión: el token presentado queda revocado para que no pueda
 *       reutilizarse en un equipo compartido.</li>
 * </ul>
 */
@Service
public class ServicioAutenticacion {

    private static final int MAX_INTENTOS = 5;
    private static final Duration BLOQUEO = Duration.ofMinutes(15);

    private static final String CREDENCIALES_INVALIDAS = "El correo o la contraseña no son correctos.";

    private final RepositorioUsuario usuarios;
    private final ServicioUsuario servicioUsuario;
    private final ServicioTokens tokens;
    private final PasswordEncoder codificador;
    private final PublicadorEventos eventos;
    private final String hashSenuelo;

    public ServicioAutenticacion(RepositorioUsuario usuarios,
                                 ServicioUsuario servicioUsuario,
                                 ServicioTokens tokens,
                                 PasswordEncoder codificador,
                                 PublicadorEventos eventos) {
        this.usuarios = usuarios;
        this.servicioUsuario = servicioUsuario;
        this.tokens = tokens;
        this.codificador = codificador;
        this.eventos = eventos;
        // Hash de referencia para gastar el mismo tiempo cuando el correo no existe.
        this.hashSenuelo = codificador.encode(UUID.randomUUID().toString());
    }

    /** HU-001: valida credenciales y entrega acceso, refresco y datos de la sesión. */
    @Transactional
    public DtoAutenticacion.RespuestaSesion iniciarSesion(DtoAutenticacion.PeticionLogin peticion, String origen) {
        String correo = peticion.correo().trim().toLowerCase(Locale.ROOT);
        Usuario usuario = usuarios.findByCorreoIgnoreCase(correo).orElse(null);
        if (usuario == null) {
            // Se compara igual contra un hash señuelo: un correo inexistente no debe
            // responder más rápido que uno real (enumeración de cuentas por tiempo).
            codificador.matches(peticion.clave(), hashSenuelo);
            throw new ErroresApi.CredencialesInvalidas(CREDENCIALES_INVALIDAS);
        }

        if (usuario.getBloqueadoHasta() != null && usuario.getBloqueadoHasta().isAfter(Instant.now())) {
            throw new ErroresApi.NoAutorizado("La cuenta está bloqueada temporalmente por intentos fallidos. Intenta más tarde.");
        }
        if (!codificador.matches(peticion.clave(), usuario.getClaveHash())) {
            registrarIntentoFallido(usuario);
            throw new ErroresApi.CredencialesInvalidas(CREDENCIALES_INVALIDAS);
        }
        // El estado solo se revela a quien demostró conocer la contraseña.
        if (!usuario.estaActivo()) {
            throw new ErroresApi.NoAutorizado("La cuenta está inactiva. Contacta al administrador del sistema.");
        }

        usuario.setIntentosFallidos(0);
        usuario.setBloqueadoHasta(null);
        usuario.setUltimoAcceso(Instant.now());
        usuarios.save(usuario);

        eventos.publicar("sesion.iniciada", "usuario", usuario.getId().toString(), usuario.getId(), usuario.getCorreo(),
                "Inicio de sesión exitoso desde " + (origen == null ? "origen desconocido" : origen) + ".");

        return respuestaSesion(usuario);
    }

    /** HU-002: revoca el token de acceso (y el de refresco si se envía). */
    @Transactional
    public void cerrarSesion(Jwt token, String refresco, UUID actorId) {
        if (token == null) {
            throw new ErroresApi.NoAutorizado("Debes iniciar sesión para cerrar la sesión.");
        }
        if (refresco != null && !refresco.isBlank()) {
            try {
                tokens.revocar(tokens.validarRefresco(refresco), "CIERRE_SESION");
            } catch (ErroresApi.CredencialesInvalidas ignorado) {
                // El refresco ya estaba expirado o revocado: no impide cerrar la sesión.
            }
        }
        tokens.revocar(token, "CIERRE_SESION");
        eventos.publicar("sesion.cerrada", "usuario", token.getSubject(), actorId, token.getClaimAsString("correo"),
                "Cierre de sesión; el token quedó revocado.");
    }

    /** Renueva el acceso a partir de un token de refresco vigente, rotando el refresco. */
    @Transactional
    public DtoAutenticacion.RespuestaRefresco refrescar(String refresco) {
        Jwt valido = tokens.validarRefresco(refresco);
        Usuario usuario = usuarios.findById(UUID.fromString(valido.getSubject()))
                .orElseThrow(() -> new ErroresApi.CredencialesInvalidas("El usuario del token ya no existe."));
        if (!usuario.estaActivo()) {
            throw new ErroresApi.NoAutorizado("La cuenta está inactiva. Contacta al administrador del sistema.");
        }
        tokens.revocar(valido, "ROTACION_REFRESCO");

        ServicioTokens.Token acceso = tokens.emitirAcceso(usuario, servicioUsuario.permisosDe(usuario));
        ServicioTokens.Token nuevoRefresco = tokens.emitirRefresco(usuario);
        return new DtoAutenticacion.RespuestaRefresco(
                new DtoAutenticacion.TokenDto(acceso.valor(), acceso.expiraEn()),
                new DtoAutenticacion.TokenDto(nuevoRefresco.valor(), nuevoRefresco.expiraEn()));
    }

    /** Datos actuales de la sesión para el encabezado del frontend. */
    @Transactional(readOnly = true)
    public DtoAutenticacion.Sesion sesionActual(UUID id) {
        return aSesion(servicioUsuario.requerir(id));
    }

    private DtoAutenticacion.RespuestaSesion respuestaSesion(Usuario usuario) {
        List<String> permisos = servicioUsuario.permisosDe(usuario);
        ServicioTokens.Token acceso = tokens.emitirAcceso(usuario, permisos);
        ServicioTokens.Token refresco = tokens.emitirRefresco(usuario);
        return new DtoAutenticacion.RespuestaSesion(
                new DtoAutenticacion.TokenDto(acceso.valor(), acceso.expiraEn()),
                new DtoAutenticacion.TokenDto(refresco.valor(), refresco.expiraEn()),
                aSesion(usuario));
    }

    private DtoAutenticacion.Sesion aSesion(Usuario usuario) {
        return new DtoAutenticacion.Sesion(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getCorreo(),
                usuario.getArea().getNombre(),
                usuario.getArea().getCodigo(),
                usuario.rolPrincipal(),
                usuario.nombresRoles(),
                servicioUsuario.permisosDe(usuario),
                iniciales(usuario.getNombre()),
                usuario.getUltimoAcceso());
    }

    private String iniciales(String nombre) {
        String[] partes = nombre.trim().split("\\s+");
        String primera = partes.length > 0 && !partes[0].isEmpty() ? partes[0].substring(0, 1) : "";
        String segunda = partes.length > 1 && !partes[1].isEmpty() ? partes[1].substring(0, 1) : "";
        return (primera + segunda).toUpperCase(Locale.ROOT);
    }

    private void registrarIntentoFallido(Usuario usuario) {
        int intentos = usuario.getIntentosFallidos() + 1;
        usuario.setIntentosFallidos(intentos);
        if (intentos >= MAX_INTENTOS) {
            usuario.setBloqueadoHasta(Instant.now().plus(BLOQUEO));
            usuario.setIntentosFallidos(0);
        }
        usuarios.save(usuario);
    }
}
