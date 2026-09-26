package co.gov.neptuno.usuarios.catalogos;

import co.gov.neptuno.usuarios.auditoria.PublicadorEventos;
import co.gov.neptuno.usuarios.comun.ErroresApi;
import co.gov.neptuno.usuarios.comun.EstadoCatalogo;
import co.gov.neptuno.usuarios.usuarios.RepositorioUsuario;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Catálogo de áreas de la organización (HU-016). Cada usuario se asocia a un área,
 * insumo de la restricción de visibilidad por rol y área (HU-014).
 */
@Service
public class ServicioArea {

    private final RepositorioArea areas;
    private final RepositorioUsuario usuarios;
    private final PublicadorEventos eventos;

    public ServicioArea(RepositorioArea areas, RepositorioUsuario usuarios, PublicadorEventos eventos) {
        this.areas = areas;
        this.usuarios = usuarios;
        this.eventos = eventos;
    }

    @Transactional(readOnly = true)
    public List<DtoCatalogo.RespuestaArea> listar(Boolean soloActivas) {
        return areas.findAllByOrderByNombreAsc().stream()
                .filter(area -> soloActivas == null || !soloActivas || area.getEstado() == EstadoCatalogo.ACTIVO)
                .map(this::aRespuesta)
                .toList();
    }

    @Transactional(readOnly = true)
    public DtoCatalogo.RespuestaArea obtener(UUID id) {
        return aRespuesta(requerir(id));
    }

    @Transactional(readOnly = true)
    public Area requerir(UUID id) {
        return areas.findById(id)
                .orElseThrow(() -> new ErroresApi.NoEncontrado("El área indicada no existe."));
    }

    @Transactional
    public DtoCatalogo.RespuestaArea crear(DtoCatalogo.PeticionArea peticion, UUID actorId) {
        String nombre = peticion.nombre().trim();
        if (areas.existsByNombreIgnoreCase(nombre)) {
            throw new ErroresApi.Conflicto("Ya existe un área con el nombre " + nombre + ".");
        }
        Area area = new Area();
        area.setNombre(nombre);
        area.setCodigo(codigo(peticion.codigo()));
        area.setResponsable(peticion.responsable());
        area.setEstado(peticion.estado() == null ? EstadoCatalogo.ACTIVO : peticion.estado());
        areas.save(area);
        eventos.publicar("catalogo.area-creada", "area", area.getId().toString(), actorId, null,
                "Se creó el área " + area.getNombre() + " (" + area.getCodigo() + ").");
        return aRespuesta(area);
    }

    @Transactional
    public DtoCatalogo.RespuestaArea editar(UUID id, DtoCatalogo.PeticionArea peticion, UUID actorId) {
        Area area = requerir(id);
        String nombre = peticion.nombre().trim();
        if (areas.existsByNombreIgnoreCaseAndIdNot(nombre, id)) {
            throw new ErroresApi.Conflicto("Ya existe otra área con el nombre " + nombre + ".");
        }
        area.setNombre(nombre);
        if (peticion.codigo() != null && !peticion.codigo().isBlank()) {
            area.setCodigo(peticion.codigo().trim());
        }
        area.setResponsable(peticion.responsable());
        if (peticion.estado() != null) {
            if (peticion.estado() == EstadoCatalogo.INACTIVO) {
                validarDesactivacion(area);
            }
            area.setEstado(peticion.estado());
        }
        area.setActualizadoEn(java.time.Instant.now());
        areas.save(area);
        eventos.publicar("catalogo.area-editada", "area", area.getId().toString(), actorId, null,
                "Se actualizó el área " + area.getNombre() + ".");
        return aRespuesta(area);
    }

    /** HU-016: desactivar un área en lugar de eliminarla para no romper el historial. */
    @Transactional
    public void desactivar(UUID id, UUID actorId) {
        Area area = requerir(id);
        if (area.getEstado() == EstadoCatalogo.INACTIVO) {
            throw new ErroresApi.ReglaInvalida("El área " + area.getNombre() + " ya está inactiva.");
        }
        validarDesactivacion(area);
        area.setEstado(EstadoCatalogo.INACTIVO);
        area.setActualizadoEn(java.time.Instant.now());
        areas.save(area);
        eventos.publicar("catalogo.area-desactivada", "area", area.getId().toString(), actorId, null,
                "Se desactivó el área " + area.getNombre() + ".");
    }

    private void validarDesactivacion(Area area) {
        if (usuarios.existsByAreaId(area.getId())) {
            throw new ErroresApi.Conflicto("El área " + area.getNombre()
                    + " tiene usuarios asignados; reasígnalos antes de desactivarla.");
        }
    }

    private String codigo(String solicitado) {
        if (solicitado != null && !solicitado.isBlank()) {
            String valor = solicitado.trim().toUpperCase(java.util.Locale.ROOT);
            if (areas.existsByCodigoIgnoreCase(valor)) {
                throw new ErroresApi.Conflicto("Ya existe un área con el código " + valor + ".");
            }
            return valor;
        }
        return "ARE-" + String.format("%02d", areas.count() + 1);
    }

    private DtoCatalogo.RespuestaArea aRespuesta(Area area) {
        return new DtoCatalogo.RespuestaArea(
                area.getId(),
                area.getCodigo(),
                area.getNombre(),
                area.getResponsable(),
                area.getEstado(),
                area.getEstado().etiqueta(),
                usuarios.countByAreaId(area.getId()),
                area.getCreadoEn(),
                area.getActualizadoEn());
    }
}
