package co.gov.neptuno.usuarios.roles;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Permiso sobre una funcionalidad (p. ej. {@code usuarios:crear}). Es la unidad que
 * se asigna a un rol (HU-011) y la que se valida en cada solicitud (HU-013).
 */
@Entity
@Table(name = "permiso", uniqueConstraints = {
        @UniqueConstraint(name = "uk_permiso_codigo", columnNames = "codigo")
})
@Getter
@Setter
@NoArgsConstructor
public class Permiso {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Código técnico validado por el servicio, formato {@code modulo:accion}. */
    @Column(nullable = false, length = 60)
    private String codigo;

    @Column(nullable = false, length = 120)
    private String nombre;

    /** Módulo funcional usado para agrupar el catálogo en la interfaz. */
    @Column(nullable = false, length = 80)
    private String modulo;

    @Column(length = 240)
    private String descripcion;

    public Permiso(String codigo, String nombre, String modulo, String descripcion) {
        this.codigo = codigo;
        this.nombre = nombre;
        this.modulo = modulo;
        this.descripcion = descripcion;
    }
}
