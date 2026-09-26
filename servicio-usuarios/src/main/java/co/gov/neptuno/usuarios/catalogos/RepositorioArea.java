package co.gov.neptuno.usuarios.catalogos;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Acceso al catálogo de áreas (HU-016). */
public interface RepositorioArea extends JpaRepository<Area, UUID> {

    boolean existsByNombreIgnoreCase(String nombre);

    boolean existsByNombreIgnoreCaseAndIdNot(String nombre, UUID id);

    boolean existsByCodigoIgnoreCase(String codigo);

    List<Area> findAllByOrderByNombreAsc();
}
