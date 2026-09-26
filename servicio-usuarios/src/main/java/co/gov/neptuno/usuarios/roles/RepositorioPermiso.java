package co.gov.neptuno.usuarios.roles;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Acceso al catálogo de permisos (HU-011, HU-013). */
public interface RepositorioPermiso extends JpaRepository<Permiso, UUID> {

    Optional<Permiso> findByCodigo(String codigo);

    List<Permiso> findByCodigoIn(Collection<String> codigos);

    boolean existsByCodigo(String codigo);

    List<Permiso> findAllByOrderByModuloAscNombreAsc();
}
