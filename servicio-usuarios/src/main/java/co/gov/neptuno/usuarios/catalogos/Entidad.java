package co.gov.neptuno.usuarios.catalogos;

import co.gov.neptuno.usuarios.comun.EstadoCatalogo;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Entidad externa (NIT + razón social) usada en radicación de Recibidos y Externos — HU-022. */
@Entity
@Table(name = "entidad", uniqueConstraints = {
        @UniqueConstraint(name = "uk_entidad_nit", columnNames = "nit")
})
@Getter
@Setter
@NoArgsConstructor
public class Entidad {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 30)
    private String nit;

    @Column(name = "razon_social", nullable = false, length = 160)
    private String razonSocial;

    @Column(length = 80)
    private String ciudad;

    /** Proveedor, Entidad pública, Cliente… */
    @Column(length = 40)
    private String tipo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EstadoCatalogo estado = EstadoCatalogo.ACTIVO;

    @Column(name = "creado_en", nullable = false, updatable = false)
    private Instant creadoEn;

    @Column(name = "actualizado_en")
    private Instant actualizadoEn;

    @PrePersist
    void alCrear() {
        this.creadoEn = Instant.now();
    }
}
