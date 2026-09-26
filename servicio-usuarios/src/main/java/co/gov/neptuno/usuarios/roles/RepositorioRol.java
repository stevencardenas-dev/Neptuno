package co.gov.neptuno.usuarios.roles;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Acceso a datos de roles (HU-007…HU-010). */
public interface RepositorioRol extends JpaRepository<Rol, UUID> {

    Optional<Rol> findByNombreIgnoreCase(String nombre);

    boolean existsByNombreIgnoreCase(String nombre);

    boolean existsByNombreIgnoreCaseAndIdNot(String nombre, UUID id);

    List<Rol> findAllByOrderByNombreAsc();

    List<Rol> findByIdIn(List<UUID> ids);
}
