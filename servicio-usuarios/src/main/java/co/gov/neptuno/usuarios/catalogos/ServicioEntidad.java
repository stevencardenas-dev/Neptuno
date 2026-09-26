package co.gov.neptuno.usuarios.catalogos;

import co.gov.neptuno.usuarios.auditoria.PublicadorEventos;
import co.gov.neptuno.usuarios.comun.ErroresApi;
import co.gov.neptuno.usuarios.comun.EstadoCatalogo;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Catálogo de entidades externas (NIT y razón social) — HU-022. */
@Service
public class ServicioEntidad {

    private final RepositorioEntidad entidades;
    private final PublicadorEventos eventos;

    public ServicioEntidad(RepositorioEntidad entidades, PublicadorEventos eventos) {
        this.entidades = entidades;
        this.eventos = eventos;
    }

    @Transactional(readOnly = true)
    public List<DtoCatalogo.RespuestaEntidad> listar(String texto, Boolean soloActivas) {
        List<Entidad> encontradas = (texto == null || texto.isBlank())
                ? entidades.findAll(org.springframework.data.domain.Sort.by("razonSocial").ascending())
                : entidades.buscar("%" + texto.trim().toLowerCase(java.util.Locale.ROOT) + "%");
        return encontradas.stream()
                .filter(entidad -> soloActivas == null || !soloActivas || entidad.getEstado() == EstadoCatalogo.ACTIVO)
                .map(this::aRespuesta)
                .toList();
    }

    @Transactional(readOnly = true)
    public DtoCatalogo.RespuestaEntidad obtener(UUID id) {
        return aRespuesta(requerir(id));
    }

    @Transactional(readOnly = true)
    public Entidad requerir(UUID id) {
        return entidades.findById(id)
                .orElseThrow(() -> new ErroresApi.NoEncontrado("La entidad indicada no existe."));
    }

    @Transactional
    public DtoCatalogo.RespuestaEntidad crear(DtoCatalogo.PeticionEntidad peticion, UUID actorId) {
        String nit = peticion.nit().trim();
        if (entidades.existsByNit(nit)) {
            throw new ErroresApi.Conflicto("Ya existe una entidad con el NIT " + nit + ".");
        }
        Entidad entidad = new Entidad();
        entidad.setNit(nit);
        entidad.setRazonSocial(peticion.razonSocial().trim());
        entidad.setCiudad(peticion.ciudad());
        entidad.setTipo(peticion.tipo());
        entidad.setEstado(peticion.estado() == null ? EstadoCatalogo.ACTIVO : peticion.estado());
        entidades.save(entidad);
        eventos.publicar("catalogo.entidad-creada", "entidad", entidad.getId().toString(), actorId, null,
                "Se creó la entidad " + entidad.getRazonSocial() + " (NIT " + entidad.getNit() + ").");
        return aRespuesta(entidad);
    }

    @Transactional
    public DtoCatalogo.RespuestaEntidad editar(UUID id, DtoCatalogo.PeticionEntidad peticion, UUID actorId) {
        Entidad entidad = requerir(id);
        String nit = peticion.nit().trim();
        if (entidades.existsByNitAndIdNot(nit, id)) {
            throw new ErroresApi.Conflicto("Ya existe otra entidad con el NIT " + nit + ".");
        }
        entidad.setNit(nit);
        entidad.setRazonSocial(peticion.razonSocial().trim());
        entidad.setCiudad(peticion.ciudad());
        entidad.setTipo(peticion.tipo());
        if (peticion.estado() != null) {
            entidad.setEstado(peticion.estado());
        }
        entidad.setActualizadoEn(java.time.Instant.now());
        entidades.save(entidad);
        eventos.publicar("catalogo.entidad-editada", "entidad", entidad.getId().toString(), actorId, null,
                "Se actualizó la entidad " + entidad.getRazonSocial() + ".");
        return aRespuesta(entidad);
    }

    /** HU-022: desactivar una entidad que ya no se usa. */
    @Transactional
    public void desactivar(UUID id, UUID actorId) {
        Entidad entidad = requerir(id);
        if (entidad.getEstado() == EstadoCatalogo.INACTIVO) {
            throw new ErroresApi.ReglaInvalida("La entidad " + entidad.getRazonSocial() + " ya está inactiva.");
        }
        entidad.setEstado(EstadoCatalogo.INACTIVO);
        entidad.setActualizadoEn(java.time.Instant.now());
        entidades.save(entidad);
        eventos.publicar("catalogo.entidad-desactivada", "entidad", entidad.getId().toString(), actorId, null,
                "Se desactivó la entidad " + entidad.getRazonSocial() + ".");
    }

    private DtoCatalogo.RespuestaEntidad aRespuesta(Entidad entidad) {
        return new DtoCatalogo.RespuestaEntidad(
                entidad.getId(),
                entidad.getNit(),
                entidad.getRazonSocial(),
                entidad.getCiudad(),
                entidad.getTipo(),
                entidad.getEstado(),
                entidad.getEstado().etiqueta(),
                entidad.getCreadoEn(),
                entidad.getActualizadoEn());
    }
}
