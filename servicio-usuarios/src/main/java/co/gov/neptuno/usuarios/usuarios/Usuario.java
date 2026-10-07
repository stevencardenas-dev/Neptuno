package co.gov.neptuno.usuarios.usuarios;

import co.gov.neptuno.usuarios.catalogos.Area;
import co.gov.neptuno.usuarios.comun.EstadoUsuario;
import co.gov.neptuno.usuarios.roles.Rol;
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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Usuario del sistema. HU-003 (crear), HU-004 (editar), HU-005 (baja lógica),
 * HU-006 (consultar y buscar) y HU-012 (asignar roles).
 */
@Entity
@Table(name = "usuario", uniqueConstraints = {
        @UniqueConstraint(name = "uk_usuario_correo", columnNames = "correo")
})
@Getter
@Setter
@NoArgsConstructor
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 120)
    private String nombre;

    /** Correo institucional, almacenado en minúsculas. */
    @Column(nullable = false, length = 160)
    private String correo;

    @Column(name = "clave_hash", nullable = false, length = 100)
    private String claveHash;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "area_id", nullable = false)
    private Area area;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EstadoUsuario estado = EstadoUsuario.ACTIVO;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "usuario_rol",
            joinColumns = @JoinColumn(name = "usuario_id"),
            inverseJoinColumns = @JoinColumn(name = "rol_id"))
    private Set<Rol> roles = new LinkedHashSet<>();

    @Column(name = "ultimo_acceso")
    private Instant ultimoAcceso;

    @Column(name = "intentos_fallidos", nullable = false)
    private int intentosFallidos;

    @Column(name = "bloqueado_hasta")
    private Instant bloqueadoHasta;

    @Column(name = "creado_en", nullable = false, updatable = false)
    private Instant creadoEn;

    @Column(name = "actualizado_en")
    private Instant actualizadoEn;

    /** Baja lógica: momento en que el administrador revocó el acceso (HU-005). */
    @Column(name = "eliminado_en")
    private Instant eliminadoEn;

    @Column(name = "eliminado_por")
    private UUID eliminadoPor;

    /**
     * HU-013: momento del último cambio de roles o permisos. Los tokens de acceso
     * emitidos antes de esta marca ya no reflejan los permisos vigentes.
     */
    @Column(name = "permisos_actualizados_en")
    private Instant permisosActualizadosEn;

    @PrePersist
    void alCrear() {
        this.creadoEn = Instant.now();
    }

    @PreUpdate
    void alActualizar() {
        this.actualizadoEn = Instant.now();
    }

    public boolean estaActivo() {
        return estado == EstadoUsuario.ACTIVO;
    }

    /** Nombres de los roles en orden alfabético. */
    public List<String> nombresRoles() {
        return roles.stream().map(Rol::getNombre).sorted().toList();
    }

    /** Rol que se muestra en la sesión: Administrador si lo tiene; si no, el primero alfabéticamente. */
    public String rolPrincipal() {
        List<String> nombres = nombresRoles();
        return nombres.stream()
                .filter(nombre -> nombre.equalsIgnoreCase(Rol.ADMINISTRADOR))
                .findFirst()
                .orElse(nombres.isEmpty() ? "Sin rol" : nombres.get(0));
    }

    /**
     * Invalida los tokens de acceso vigentes porque sus permisos cambiaron (HU-013).
     * Se trunca a segundos porque el {@code iat} del JWT tiene esa precisión.
     */
    public void marcarPermisosActualizados() {
        this.permisosActualizadosEn = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    }
}
