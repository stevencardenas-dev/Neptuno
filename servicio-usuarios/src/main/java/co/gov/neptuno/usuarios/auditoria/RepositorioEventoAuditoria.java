package co.gov.neptuno.usuarios.auditoria;

import co.gov.neptuno.usuarios.comun.EstadoPublicacion;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Eventos de bitácora generados por el servicio. */
public interface RepositorioEventoAuditoria extends JpaRepository<EventoAuditoria, UUID> {

    List<EventoAuditoria> findTop100ByEstadoPublicacionOrderByOcurridoEnAsc(EstadoPublicacion estado);

    List<EventoAuditoria> findTop100ByOrderByOcurridoEnDesc();
}
