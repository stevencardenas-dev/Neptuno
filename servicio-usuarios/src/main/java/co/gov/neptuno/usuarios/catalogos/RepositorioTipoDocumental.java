package co.gov.neptuno.usuarios.catalogos;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Acceso al catálogo de tipos documentales (HU-015). */
public interface RepositorioTipoDocumental extends JpaRepository<TipoDocumental, UUID> {

    boolean existsByNombreIgnoreCase(String nombre);

    boolean existsByNombreIgnoreCaseAndIdNot(String nombre, UUID id);

    List<TipoDocumental> findAllByOrderByNombreAsc();
}
