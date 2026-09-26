package co.gov.neptuno.usuarios.roles;

import co.gov.neptuno.usuarios.auditoria.PublicadorEventos;
import co.gov.neptuno.usuarios.comun.ErroresApi;
import co.gov.neptuno.usuarios.comun.TipoRol;
import co.gov.neptuno.usuarios.usuarios.RepositorioUsuario;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reglas de negocio de roles y permisos.
 *
 * <ul>
 *   <li>HU-007 Crear rol</li>
 *   <li>HU-008 Editar rol</li>
 *   <li>HU-009 Eliminar rol sin usuarios asignados</li>
 *   <li>HU-010 Consultar roles con sus permisos y usuarios asignados</li>
 *   <li>HU-011 Asignar permisos a un rol</li>
 * </ul>
 */
@Service
public class ServicioRol {

    private final RepositorioRol roles;
    private final RepositorioPermiso permisos;
    private final RepositorioUsuario usuarios;
    private final PublicadorEventos eventos;

    public ServicioRol(RepositorioRol roles,
                       RepositorioPermiso permisos,
                       RepositorioUsuario usuarios,
                       PublicadorEventos eventos) {
        this.roles = roles;
        this.permisos = permisos;
        this.usuarios = usuarios;
        this.eventos = eventos;
    }

    /* ------------------------------- Consultas ------------------------------- */

    /** HU-010: catálogo de roles con la cuenta de permisos y usuarios asignados. */
    @Transactional(readOnly = true)
    public List<DtoRol.Respuesta> listar() {
        Map<UUID, Long> conteos = conteosPorRol();
        return roles.findAllByOrderByNombreAsc().stream()
                .map(rol -> aRespuesta(rol, conteos.getOrDefault(rol.getId(), 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public DtoRol.Respuesta obtener(UUID id) {
        Rol rol = requerir(id);
        return aRespuesta(rol, usuarios.countByRolesId(id));
    }

    /** HU-010 (tarjeta "Usuarios con este rol"). */
    @Transactional(readOnly = true)
    public List<DtoRol.UsuarioDelRol> usuariosDelRol(UUID id) {
        Rol rol = requerir(id);
        return usuarios.findAll((root, consulta, cb) -> cb.equal(root.join("roles").get("id"), rol.getId()))
                .stream()
                .map(usuario -> new DtoRol.UsuarioDelRol(
                        usuario.getId(),
                        usuario.getNombre(),
                        usuario.getCorreo(),
                        usuario.getArea().getNombre(),
                        usuario.getEstado().etiqueta()))
                .toList();
    }

    /** HU-011: catálogo completo de permisos agrupado por módulo. */
    @Transactional(readOnly = true)
    public List<DtoRol.GrupoPermisos> catalogoPermisos() {
        Map<String, List<DtoRol.PermisoResumen>> porModulo = new LinkedHashMap<>();
        for (Permiso permiso : permisos.findAllByOrderByModuloAscNombreAsc()) {
            porModulo.computeIfAbsent(permiso.getModulo(), modulo -> new java.util.ArrayList<>())
                    .add(aResumen(permiso));
        }
        return porModulo.entrySet().stream()
                .map(entrada -> new DtoRol.GrupoPermisos(entrada.getKey(), entrada.getValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Rol requerir(UUID id) {
        return roles.findById(id)
                .orElseThrow(() -> new ErroresApi.NoEncontrado("El rol indicado no existe."));
    }

    /* ------------------------------- Comandos -------------------------------- */

    /** HU-007: crear un rol y, opcionalmente, sus permisos iniciales. */
    @Transactional
    public DtoRol.Respuesta crear(DtoRol.PeticionCrear peticion, UUID actorId) {
        String nombre = peticion.nombre().trim();
        if (roles.existsByNombreIgnoreCase(nombre)) {
            throw new ErroresApi.Conflicto("Ya existe un rol con el nombre " + nombre + ".");
        }

        Rol rol = new Rol();
        rol.setNombre(nombre);
        rol.setDescripcion(peticion.descripcion());
        rol.setTipo(peticion.tipo() == null ? TipoRol.OPERATIVO : peticion.tipo());
        rol.setPermisos(resolverPermisos(peticion.permisos()));
        roles.save(rol);

        eventos.publicar("rol.creado", "rol", rol.getId().toString(), actorId, null,
                "Se creó el rol " + rol.getNombre() + " con " + rol.getPermisos().size() + " permisos.");
        return aRespuesta(rol, 0L);
    }

    /** HU-008: editar nombre, descripción y tipo de un rol. */
    @Transactional
    public DtoRol.Respuesta editar(UUID id, DtoRol.PeticionEditar peticion, UUID actorId) {
        Rol rol = requerir(id);
        String nombre = peticion.nombre().trim();
        if (rol.getTipo() == TipoRol.SISTEMA && !rol.getNombre().equalsIgnoreCase(nombre)) {
            throw new ErroresApi.Conflicto("El rol de sistema " + rol.getNombre() + " no puede renombrarse.");
        }
        if (roles.existsByNombreIgnoreCaseAndIdNot(nombre, id)) {
            throw new ErroresApi.Conflicto("Ya existe otro rol con el nombre " + nombre + ".");
        }

        rol.setNombre(nombre);
        rol.setDescripcion(peticion.descripcion());
        if (peticion.tipo() != null) {
            if (rol.getTipo() == TipoRol.SISTEMA && peticion.tipo() != TipoRol.SISTEMA) {
                throw new ErroresApi.ReglaInvalida("El rol de sistema " + rol.getNombre() + " debe conservar su tipo.");
            }
            rol.setTipo(peticion.tipo());
        }
        roles.save(rol);

        eventos.publicar("rol.editado", "rol", rol.getId().toString(), actorId, null,
                "Se actualizó el rol " + rol.getNombre() + ".");
        return aRespuesta(rol, usuarios.countByRolesId(id));
    }

    /** HU-009: solo se elimina un rol sin usuarios asignados. */
    @Transactional
    public void eliminar(UUID id, UUID actorId) {
        Rol rol = requerir(id);
        if (rol.getTipo() == TipoRol.SISTEMA) {
            throw new ErroresApi.Conflicto("El rol de sistema " + rol.getNombre() + " no puede eliminarse.");
        }
        long asignados = usuarios.countByRolesId(id);
        if (asignados > 0) {
            throw new ErroresApi.Conflicto("El rol " + rol.getNombre() + " tiene " + asignados
                    + " usuarios asignados; solo se puede eliminar un rol sin usuarios.");
        }
        roles.delete(rol);
        eventos.publicar("rol.eliminado", "rol", rol.getId().toString(), actorId, null,
                "Se eliminó el rol " + rol.getNombre() + ".");
    }

    /** HU-011: asignar o quitar permisos sobre funcionalidades a un rol. */
    @Transactional
    public DtoRol.Respuesta asignarPermisos(UUID id, DtoRol.PeticionPermisos peticion, UUID actorId) {
        Rol rol = requerir(id);
        Set<Permiso> nuevos = resolverPermisos(peticion.permisos());
        int antes = rol.getPermisos().size();
        rol.setPermisos(nuevos);
        roles.save(rol);

        eventos.publicar("rol.permisos-asignados", "rol", rol.getId().toString(), actorId, null,
                "Permisos del rol " + rol.getNombre() + ": " + antes + " -> " + nuevos.size()
                        + " (" + nuevos.stream().map(Permiso::getCodigo).sorted().toList() + ").");
        return aRespuesta(rol, usuarios.countByRolesId(id));
    }

    /* ------------------------------- Apoyo ----------------------------------- */

    private Set<Permiso> resolverPermisos(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return new LinkedHashSet<>();
        }
        List<UUID> distintos = ids.stream().distinct().toList();
        List<Permiso> encontrados = permisos.findAllById(distintos);
        if (encontrados.size() != distintos.size()) {
            throw new ErroresApi.NoEncontrado("Alguno de los permisos indicados no existe.");
        }
        return new LinkedHashSet<>(encontrados);
    }

    private Map<UUID, Long> conteosPorRol() {
        Map<UUID, Long> conteos = new LinkedHashMap<>();
        for (Object[] fila : usuarios.contarUsuariosPorRol()) {
            conteos.put((UUID) fila[0], (Long) fila[1]);
        }
        return conteos;
    }

    private DtoRol.Respuesta aRespuesta(Rol rol, long usuariosAsignados) {
        List<DtoRol.PermisoResumen> detalle = rol.getPermisos().stream()
                .map(this::aResumen)
                .sorted((a, b) -> a.codigo().compareToIgnoreCase(b.codigo()))
                .toList();
        return new DtoRol.Respuesta(
                rol.getId(),
                rol.getNombre(),
                rol.getDescripcion(),
                rol.getTipo(),
                rol.getTipo().etiqueta(),
                detalle.size(),
                usuariosAsignados,
                detalle,
                rol.getCreadoEn(),
                rol.getActualizadoEn());
    }

    private DtoRol.PermisoResumen aResumen(Permiso permiso) {
        return new DtoRol.PermisoResumen(permiso.getId(), permiso.getCodigo(), permiso.getNombre(),
                permiso.getModulo(), permiso.getDescripcion());
    }

    /** Busca un rol por nombre, usado por la siembra de datos y las pruebas. */
    @Transactional(readOnly = true)
    public java.util.Optional<Rol> porNombre(String nombre) {
        return roles.findByNombreIgnoreCase(nombre.trim());
    }
}
