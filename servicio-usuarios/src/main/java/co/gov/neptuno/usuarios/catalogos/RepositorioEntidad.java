package co.gov.neptuno.usuarios.catalogos;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Acceso al catálogo de entidades externas (HU-022). */
public interface RepositorioEntidad extends JpaRepository<Entidad, UUID> {

    boolean existsByNit(String nit);

    boolean existsByNitAndIdNot(String nit, UUID id);

    @Query("""
            select e from Entidad e
            where lower(e.razonSocial) like :texto or e.nit like :texto
            order by e.razonSocial asc
            """)
    List<Entidad> buscar(@Param("texto") String texto);
}
