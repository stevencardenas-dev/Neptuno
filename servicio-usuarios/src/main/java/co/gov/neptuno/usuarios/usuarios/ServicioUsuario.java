package co.gov.neptuno.usuarios.usuarios;

import co.gov.neptuno.usuarios.auditoria.PublicadorEventos;
import co.gov.neptuno.usuarios.catalogos.Area;
import co.gov.neptuno.usuarios.catalogos.RepositorioArea;
import co.gov.neptuno.usuarios.comun.ErroresApi;
import co.gov.neptuno.usuarios.comun.EstadoCatalogo;
import co.gov.neptuno.usuarios.comun.EstadoUsuario;
import co.gov.neptuno.usuarios.comun.RespuestaPagina;
import co.gov.neptuno.usuarios.roles.RepositorioRol;
import co.gov.neptuno.usuarios.roles.Rol;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reglas de negocio de la administración de usuarios.
 *
 * <ul>
 *   <li>HU-003 Crear usuario</li>
 *   <li>HU-004 Editar usuario</li>
 *   <li>HU-005 Eliminar usuario (baja lógica)</li>
 *   <li>HU-006 Consultar y buscar usuarios</li>
 *   <li>HU-012 Asignar roles a un usuario</li>
 * </ul>
 */
@Service
public class ServicioUsuario {

    private static final String ROL_ADMINISTRADOR = "Administrador";

    private final RepositorioUsuario usuarios;
    private final RepositorioRol roles;
    private final RepositorioArea areas;
    private final PasswordEncoder codificadorClaves;
    private final PublicadorEventos eventos;

    public ServicioUsuario(RepositorioUsuario usuarios,
                           RepositorioRol roles,
                           RepositorioArea areas,
                           PasswordEncoder codificadorClaves,
                           PublicadorEventos eventos) {
        this.usuarios = usuarios;
        this.roles = roles;
        this.areas = areas;
        this.codificadorClaves = codificadorClaves;
        this.eventos = eventos;
    }

    /* ------------------------------- Consultas ------------------------------- */

    /** HU-006: listado filtrable por texto (nombre o correo), rol, estado y área. */
    @Transactional(readOnly = true)
    public RespuestaPagina<DtoUsuario.Respuesta> buscar(String texto, UUID rolId, EstadoUsuario estado,
                                                        UUID areaId, Pageable paginacion) {
        Page<Usuario> pagina = usuarios.findAll(filtro(texto, rolId, estado, areaId), paginacion);
        return RespuestaPagina.de(pagina, this::aRespuesta);
    }

    @Transactional(readOnly = true)
    public DtoUsuario.Respuesta obtener(UUID id) {
        return aRespuesta(requerir(id));
    }

    /** HU-014: contexto de rol y área que otros microservicios usan para filtrar documentos. */
    @Transactional(readOnly = true)
    public DtoUsuario.ContextoAcceso contextoAcceso(UUID id) {
        Usuario usuario = requerir(id);
        List<String> permisos = permisosDe(usuario);
        return new DtoUsuario.ContextoAcceso(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getCorreo(),
                usuario.getEstado(),
                usuario.getArea().getId(),
                usuario.getArea().getNombre(),
                usuario.getArea().getCodigo(),
                usuario.getRoles().stream().map(Rol::getNombre).sorted().toList(),
                rolPrincipal(usuario),
                permisos);
    }

    /** HU-014: contexto de acceso de varios usuarios en una sola llamada (bandejas de tareas). */
    @Transactional(readOnly = true)
    public List<DtoUsuario.ContextoAcceso> contextosAcceso(List<UUID> ids) {
        return usuarios.findByIdIn(ids).stream()
                .map(usuario -> contextoAcceso(usuario.getId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Usuario requerir(UUID id) {
        return usuarios.findById(id)
                .orElseThrow(() -> new ErroresApi.NoEncontrado("El usuario indicado no existe."));
    }

    @Transactional(readOnly = true)
    public List<String> permisosDe(Usuario usuario) {
        return usuario.getRoles().stream()
                .flatMap(rol -> rol.getPermisos().stream())
                .map(permiso -> permiso.getCodigo())
                .distinct()
                .sorted()
                .collect(Collectors.toCollection(ArrayList::new));
    }

    /* ------------------------------- Comandos -------------------------------- */

    /** HU-003: crear usuario con área activa y roles existentes. */
    @Transactional
    public DtoUsuario.Respuesta crear(DtoUsuario.PeticionCrear peticion, UUID actorId) {
        String correo = normalizarCorreo(peticion.correo());
        if (usuarios.existsByCorreoIgnoreCase(correo)) {
            throw new ErroresApi.Conflicto("Ya existe un usuario con el correo " + correo + ".");
        }

        Area area = areas.findById(peticion.areaId())
                .orElseThrow(() -> new ErroresApi.NoEncontrado("El área indicada no existe."));
        if (area.getEstado() != EstadoCatalogo.ACTIVO) {
            throw new ErroresApi.ReglaInvalida("El área " + area.getNombre() + " está inactiva y no puede asignarse a un usuario.");
        }

        Usuario usuario = new Usuario();
        usuario.setNombre(peticion.nombre().trim());
        usuario.setCorreo(correo);
        usuario.setClaveHash(codificadorClaves.encode(peticion.clave()));
        usuario.setArea(area);
        usuario.setEstado(peticion.estado() == null ? EstadoUsuario.ACTIVO : peticion.estado());
        usuario.setRoles(resolverRoles(peticion.roles()));
        usuarios.save(usuario);

        eventos.publicar("usuario.creado", "usuario", usuario.getId().toString(), actorId, usuario.getCorreo(),
                "Se creó el usuario " + usuario.getNombre() + " (" + usuario.getCorreo() + ") en el área " + area.getNombre() + ".");
        return aRespuesta(usuario);
    }

    /** HU-004: actualizar nombre, correo, área y estado de un usuario existente. */
    @Transactional
    public DtoUsuario.Respuesta editar(UUID id, DtoUsuario.PeticionEditar peticion, UUID actorId) {
        Usuario usuario = requerir(id);
        String correo = normalizarCorreo(peticion.correo());
        if (usuarios.existsByCorreoIgnoreCaseAndIdNot(correo, id)) {
            throw new ErroresApi.Conflicto("Otro usuario ya usa el correo " + correo + ".");
        }

        Area area = areas.findById(peticion.areaId())
                .orElseThrow(() -> new ErroresApi.NoEncontrado("El área indicada no existe."));
        if (area.getEstado() != EstadoCatalogo.ACTIVO && !area.getId().equals(usuario.getArea().getId())) {
            throw new ErroresApi.ReglaInvalida("El área " + area.getNombre() + " está inactiva y no puede asignarse a un usuario.");
        }

        usuario.setNombre(peticion.nombre().trim());
        usuario.setCorreo(correo);
        usuario.setArea(area);

        if (peticion.estado() != null && peticion.estado() != usuario.getEstado()) {
            if (peticion.estado() == EstadoUsuario.INACTIVO) {
                validarBajaSegura(usuario.getId());
                usuario.setEstado(EstadoUsuario.INACTIVO);
                usuario.setEliminadoEn(java.time.Instant.now());
                usuario.setEliminadoPor(actorId);
            } else {
                usuario.setEstado(EstadoUsuario.ACTIVO);
                usuario.setEliminadoEn(null);
                usuario.setEliminadoPor(null);
                usuario.setIntentosFallidos(0);
                usuario.setBloqueadoHasta(null);
            }
        }

        usuarios.save(usuario);
        eventos.publicar("usuario.editado", "usuario", usuario.getId().toString(), actorId, usuario.getCorreo(),
                "Se actualizó la información del usuario " + usuario.getNombre() + ".");
        return aRespuesta(usuario);
    }

    /** HU-005: baja lógica; el usuario conserva su historial en la bitácora. */
    @Transactional
    public void darDeBaja(UUID id, UUID actorId) {
        Usuario usuario = requerir(id);
        if (usuario.getId().equals(actorId)) {
            throw new ErroresApi.ReglaInvalida("No puedes dar de baja tu propia cuenta.");
        }
        if (!usuario.estaActivo()) {
            throw new ErroresApi.ReglaInvalida("El usuario " + usuario.getNombre() + " ya está dado de baja.");
        }
        validarBajaSegura(usuario.getId());

        usuario.setEstado(EstadoUsuario.INACTIVO);
        usuario.setEliminadoEn(java.time.Instant.now());
        usuario.setEliminadoPor(actorId);
        usuarios.save(usuario);

        eventos.publicar("usuario.eliminado", "usuario", usuario.getId().toString(), actorId, usuario.getCorreo(),
                "Baja lógica del usuario " + usuario.getNombre() + "; se revocó su acceso conservando el historial.");
    }

    /** HU-012: asignar o quitar roles a un usuario. */
    @Transactional
    public DtoUsuario.Respuesta asignarRoles(UUID id, DtoUsuario.PeticionRoles peticion, UUID actorId) {
        Usuario usuario = requerir(id);
        Set<Rol> nuevos = resolverRoles(peticion.roles());

        boolean conservaAdministrador = nuevos.stream().anyMatch(rol -> rol.getNombre().equalsIgnoreCase(ROL_ADMINISTRADOR));
        boolean esAdministrador = usuario.getRoles().stream().anyMatch(rol -> rol.getNombre().equalsIgnoreCase(ROL_ADMINISTRADOR));
        if (esAdministrador && !conservaAdministrador
                && usuarios.countByRolesNombreIgnoreCaseAndEstado(ROL_ADMINISTRADOR, EstadoUsuario.ACTIVO) <= 1) {
            throw new ErroresApi.Conflicto("El sistema debe conservar al menos un usuario activo con el rol Administrador.");
        }

        List<String> anteriores = usuario.getRoles().stream().map(Rol::getNombre).sorted().toList();
        usuario.setRoles(nuevos);
        usuarios.save(usuario);

        List<String> actuales = usuario.getRoles().stream().map(Rol::getNombre).sorted().toList();
        eventos.publicar("usuario.roles-asignados", "usuario", usuario.getId().toString(), actorId, usuario.getCorreo(),
                "Roles de " + usuario.getNombre() + ": " + anteriores + " -> " + actuales + ".");
        return aRespuesta(usuario);
    }

    /** Cambio de contraseña administrado por un usuario con permiso de edición. */
    @Transactional
    public void cambiarClave(UUID id, String clave, UUID actorId) {
        Usuario usuario = requerir(id);
        usuario.setClaveHash(codificadorClaves.encode(clave));
        usuario.setIntentosFallidos(0);
        usuario.setBloqueadoHasta(null);
        usuarios.save(usuario);
        eventos.publicar("usuario.clave-actualizada", "usuario", usuario.getId().toString(), actorId, usuario.getCorreo(),
                "Se actualizó la contraseña del usuario " + usuario.getNombre() + ".");
    }

    /* ------------------------------- Apoyo ----------------------------------- */

    private Specification<Usuario> filtro(String texto, UUID rolId, EstadoUsuario estado, UUID areaId) {
        return (root, consulta, cb) -> {
            List<Predicate> condiciones = new ArrayList<>();
            if (texto != null && !texto.isBlank()) {
                String patron = "%" + texto.trim().toLowerCase(Locale.ROOT) + "%";
                condiciones.add(cb.or(
                        cb.like(cb.lower(root.get("nombre")), patron),
                        cb.like(cb.lower(root.get("correo")), patron)));
            }
            if (estado != null) {
                condiciones.add(cb.equal(root.get("estado"), estado));
            }
            if (areaId != null) {
                condiciones.add(cb.equal(root.get("area").get("id"), areaId));
            }
            if (rolId != null) {
                condiciones.add(cb.equal(root.join("roles", JoinType.INNER).get("id"), rolId));
            }
            return cb.and(condiciones.toArray(new Predicate[0]));
        };
    }

    private Set<Rol> resolverRoles(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return new LinkedHashSet<>();
        }
        List<Rol> encontrados = roles.findByIdIn(ids.stream().distinct().toList());
        if (encontrados.size() != ids.stream().distinct().count()) {
            throw new ErroresApi.NoEncontrado("Alguno de los roles indicados no existe.");
        }
        encontrados.sort(Comparator.comparing(Rol::getNombre));
        return new LinkedHashSet<>(encontrados);
    }

    private void validarBajaSegura(UUID usuarioId) {
        Usuario usuario = usuarios.findById(usuarioId).orElseThrow();
        boolean esAdministrador = usuario.getRoles().stream().anyMatch(rol -> rol.getNombre().equalsIgnoreCase(ROL_ADMINISTRADOR));
        if (esAdministrador && usuarios.countByRolesNombreIgnoreCaseAndEstado(ROL_ADMINISTRADOR, EstadoUsuario.ACTIVO) <= 1) {
            throw new ErroresApi.Conflicto("No puedes dar de baja al último usuario activo con el rol Administrador.");
        }
    }

    private String rolPrincipal(Usuario usuario) {
        return usuario.getRoles().stream()
                .map(Rol::getNombre)
                .sorted((a, b) -> a.equalsIgnoreCase(ROL_ADMINISTRADOR) ? -1 : b.equalsIgnoreCase(ROL_ADMINISTRADOR) ? 1 : a.compareTo(b))
                .findFirst()
                .orElse("Sin rol");
    }

    private String normalizarCorreo(String correo) {
        return correo.trim().toLowerCase(Locale.ROOT);
    }

    public DtoUsuario.Respuesta aRespuesta(Usuario usuario) {
        return new DtoUsuario.Respuesta(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getCorreo(),
                new DtoUsuario.AreaResumen(usuario.getArea().getId(), usuario.getArea().getCodigo(), usuario.getArea().getNombre()),
                usuario.getEstado(),
                usuario.getEstado().etiqueta(),
                usuario.getRoles().stream()
                        .map(rol -> new DtoUsuario.RolResumen(rol.getId(), rol.getNombre(), rol.getTipo().etiqueta()))
                        .toList(),
                usuario.getUltimoAcceso(),
                usuario.getCreadoEn(),
                usuario.getActualizadoEn(),
                usuario.getEliminadoEn());
    }
}
