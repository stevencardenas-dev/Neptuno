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

/**
 * Área de la organización (HU-016). Cada usuario y cada documento se asocian a un área,
 * base para restringir la visibilidad por rol y área (HU-014).
 */
@Entity
@Table(name = "area", uniqueConstraints = {
        @UniqueConstraint(name = "uk_area_codigo", columnNames = "codigo"),
        @UniqueConstraint(name = "uk_area_nombre", columnNames = "nombre")
})
@Getter
@Setter
@NoArgsConstructor
public class Area {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 20)
    private String codigo;

    @Column(nullable = false, length = 120)
    private String nombre;

    @Column(length = 120)
    private String responsable;

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
