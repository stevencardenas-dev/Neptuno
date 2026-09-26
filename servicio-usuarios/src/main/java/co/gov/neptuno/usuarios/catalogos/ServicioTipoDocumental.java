package co.gov.neptuno.usuarios.catalogos;

import co.gov.neptuno.usuarios.auditoria.PublicadorEventos;
import co.gov.neptuno.usuarios.comun.ErroresApi;
import co.gov.neptuno.usuarios.comun.EstadoCatalogo;
import co.gov.neptuno.usuarios.comun.OrigenDocumento;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Catálogo de tipos documentales (Factura, Orden de compra, Contrato…) — HU-015. */
@Service
public class ServicioTipoDocumental {

    private final RepositorioTipoDocumental tipos;
    private final PublicadorEventos eventos;

    public ServicioTipoDocumental(RepositorioTipoDocumental tipos, PublicadorEventos eventos) {
        this.tipos = tipos;
        this.eventos = eventos;
    }

    @Transactional(readOnly = true)
    public List<DtoCatalogo.RespuestaTipoDocumental> listar(Boolean soloActivos, OrigenDocumento origen) {
        return tipos.findAllByOrderByNombreAsc().stream()
                .filter(tipo -> soloActivos == null || !soloActivos || tipo.getEstado() == EstadoCatalogo.ACTIVO)
                .filter(tipo -> origen == null || tipo.getOrigenes().contains(origen))
                .map(this::aRespuesta)
                .toList();
    }

    @Transactional(readOnly = true)
    public DtoCatalogo.RespuestaTipoDocumental obtener(UUID id) {
        return aRespuesta(requerir(id));
    }

    @Transactional(readOnly = true)
    public TipoDocumental requerir(UUID id) {
        return tipos.findById(id)
                .orElseThrow(() -> new ErroresApi.NoEncontrado("El tipo documental indicado no existe."));
    }

    @Transactional
    public DtoCatalogo.RespuestaTipoDocumental crear(DtoCatalogo.PeticionTipoDocumental peticion, UUID actorId) {
        String nombre = peticion.nombre().trim();
        if (tipos.existsByNombreIgnoreCase(nombre)) {
            throw new ErroresApi.Conflicto("Ya existe un tipo documental con el nombre " + nombre + ".");
        }
        TipoDocumental tipo = new TipoDocumental();
        tipo.setNombre(nombre);
        tipo.setPrefijo(peticion.prefijo());
        tipo.setOrigenes(validarOrigenes(peticion.origenes()));
        tipo.setEstado(peticion.estado() == null ? EstadoCatalogo.ACTIVO : peticion.estado());
        tipos.save(tipo);
        eventos.publicar("catalogo.tipo-documental-creado", "tipo_documental", tipo.getId().toString(), actorId, null,
                "Se creó el tipo documental " + tipo.getNombre() + " para los orígenes " + tipo.getOrigenes() + ".");
        return aRespuesta(tipo);
    }

    @Transactional
    public DtoCatalogo.RespuestaTipoDocumental editar(UUID id, DtoCatalogo.PeticionTipoDocumental peticion, UUID actorId) {
        TipoDocumental tipo = requerir(id);
        String nombre = peticion.nombre().trim();
        if (tipos.existsByNombreIgnoreCaseAndIdNot(nombre, id)) {
            throw new ErroresApi.Conflicto("Ya existe otro tipo documental con el nombre " + nombre + ".");
        }
        tipo.setNombre(nombre);
        tipo.setPrefijo(peticion.prefijo());
        tipo.setOrigenes(validarOrigenes(peticion.origenes()));
        if (peticion.estado() != null) {
            tipo.setEstado(peticion.estado());
        }
        tipo.setActualizadoEn(java.time.Instant.now());
        tipos.save(tipo);
        eventos.publicar("catalogo.tipo-documental-editado", "tipo_documental", tipo.getId().toString(), actorId, null,
                "Se actualizó el tipo documental " + tipo.getNombre() + ".");
        return aRespuesta(tipo);
    }

    /** HU-015: desactivar (no eliminar) para no invalidar los radicados históricos. */
    @Transactional
    public void desactivar(UUID id, UUID actorId) {
        TipoDocumental tipo = requerir(id);
        if (tipo.getEstado() == EstadoCatalogo.INACTIVO) {
            throw new ErroresApi.ReglaInvalida("El tipo documental " + tipo.getNombre() + " ya está inactivo.");
        }
        tipo.setEstado(EstadoCatalogo.INACTIVO);
        tipo.setActualizadoEn(java.time.Instant.now());
        tipos.save(tipo);
        eventos.publicar("catalogo.tipo-documental-desactivado", "tipo_documental", tipo.getId().toString(), actorId, null,
                "Se desactivó el tipo documental " + tipo.getNombre() + ".");
    }

    private LinkedHashSet<OrigenDocumento> validarOrigenes(java.util.Set<OrigenDocumento> origenes) {
        if (origenes == null || origenes.isEmpty()) {
            throw new ErroresApi.ReglaInvalida("Un tipo documental debe estar disponible en al menos un origen.");
        }
        return new LinkedHashSet<>(origenes);
    }

    private DtoCatalogo.RespuestaTipoDocumental aRespuesta(TipoDocumental tipo) {
        return new DtoCatalogo.RespuestaTipoDocumental(
                tipo.getId(),
                tipo.getNombre(),
                tipo.getPrefijo(),
                tipo.getOrigenes(),
                tipo.getEstado(),
                tipo.getEstado().etiqueta(),
                tipo.getCreadoEn(),
                tipo.getActualizadoEn());
    }
}
