package co.gov.neptuno.usuarios.roles;

import co.gov.neptuno.usuarios.comun.TipoRol;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
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

/** Rol del sistema: agrupa permisos y se asigna a los usuarios (HU-007…HU-012). */
@Entity
@Table(name = "rol", uniqueConstraints = {
        @UniqueConstraint(name = "uk_rol_nombre", columnNames = "nombre")
})
@Getter
@Setter
@NoArgsConstructor
public class Rol {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 80)
    private String nombre;

    @Column(length = 300)
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoRol tipo = TipoRol.OPERATIVO;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "rol_permiso",
            joinColumns = @JoinColumn(name = "rol_id"),
            inverseJoinColumns = @JoinColumn(name = "permiso_id"))
    private Set<Permiso> permisos = new LinkedHashSet<>();

    @Column(name = "creado_en", nullable = false, updatable = false)
    private Instant creadoEn;

    @Column(name = "actualizado_en")
    private Instant actualizadoEn;

    @PrePersist
    void alCrear() {
        this.creadoEn = Instant.now();
    }
}
