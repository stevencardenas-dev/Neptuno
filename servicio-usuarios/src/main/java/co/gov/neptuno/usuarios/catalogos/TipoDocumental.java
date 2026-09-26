package co.gov.neptuno.usuarios.catalogos;

import co.gov.neptuno.usuarios.comun.EstadoCatalogo;
import co.gov.neptuno.usuarios.comun.OrigenDocumento;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Tipo documental (Factura, Orden de compra, Contrato…) — HU-015. */
@Entity
@Table(name = "tipo_documental", uniqueConstraints = {
        @UniqueConstraint(name = "uk_tipo_documental_nombre", columnNames = "nombre")
})
@Getter
@Setter
@NoArgsConstructor
public class TipoDocumental {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 120)
    private String nombre;

    @Column(length = 10)
    private String prefijo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EstadoCatalogo estado = EstadoCatalogo.ACTIVO;

    /** Orígenes en los que puede usarse el tipo documental (Interno, Externo, Recibido, No radicable). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "tipo_documental_origen", joinColumns = @JoinColumn(name = "tipo_documental_id"))
    @Column(name = "origen", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private Set<OrigenDocumento> origenes = new LinkedHashSet<>();

    @Column(name = "creado_en", nullable = false, updatable = false)
    private Instant creadoEn;

    @Column(name = "actualizado_en")
    private Instant actualizadoEn;

    @PrePersist
    void alCrear() {
        this.creadoEn = Instant.now();
    }
}
