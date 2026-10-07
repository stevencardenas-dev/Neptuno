package co.gov.neptuno.usuarios.usuarios;

import co.gov.neptuno.usuarios.comun.EstadoUsuario;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

/** Acceso a datos de usuarios (HU-003…HU-006, HU-012). */
public interface RepositorioUsuario extends JpaRepository<Usuario, UUID>, JpaSpecificationExecutor<Usuario> {

    Optional<Usuario> findByCorreoIgnoreCase(String correo);

    boolean existsByCorreoIgnoreCase(String correo);

    boolean existsByCorreoIgnoreCaseAndIdNot(String correo, UUID id);

    /** Usuarios asignados a un rol (HU-009 / HU-010). */
    long countByRolesId(UUID rolId);

    List<Usuario> findByRolesId(UUID rolId);

    /** Usuarios activos con un rol determinado; se usa para proteger al último administrador. */
    long countByRolesNombreIgnoreCaseAndEstado(String nombreRol, EstadoUsuario estado);

    /** Usuarios (activos o no) de un área; evita desactivar áreas en uso (HU-016). */
    boolean existsByAreaId(UUID areaId);

    long countByAreaId(UUID areaId);

    List<Usuario> findByIdIn(Collection<UUID> ids);

    /** Conteo de usuarios por rol para la vista de roles (HU-010). */
    @Query("select r.id, count(u.id) from Usuario u join u.roles r group by r.id")
    List<Object[]> contarUsuariosPorRol();
}
