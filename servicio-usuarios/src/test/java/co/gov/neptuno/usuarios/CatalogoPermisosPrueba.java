package co.gov.neptuno.usuarios;

import static org.assertj.core.api.Assertions.assertThat;

import co.gov.neptuno.usuarios.roles.CatalogoPermisos;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Verifica que los permisos validados en los controladores existan en el catálogo. */
class CatalogoPermisosPrueba {

    /** Códigos exigidos con @PreAuthorize en los controladores del servicio. */
    private static final List<String> EXIGIDOS = List.of(
            "usuarios:consultar",
            "usuarios:crear",
            "usuarios:editar",
            "usuarios:eliminar",
            "usuarios:asignar-roles",
            "roles:consultar",
            "roles:crear",
            "roles:editar",
            "roles:eliminar",
            "roles:asignar-permisos",
            "catalogos:consultar",
            "catalogos:administrar");

    @Test
    @DisplayName("HU-011: el catálogo declarado cubre todos los permisos que valida el API")
    void catalogoCubreLosPermisosDelApi() {
        Set<String> codigos = CatalogoPermisos.definiciones().stream()
                .map(CatalogoPermisos.Definicion::codigo)
                .collect(Collectors.toSet());

        assertThat(codigos).containsAll(EXIGIDOS);
        assertThat(codigos).hasSize(CatalogoPermisos.definiciones().size());
    }

    @Test
    @DisplayName("HU-011: cada permiso tiene módulo y descripción")
    void cadaPermisoEstaDocumentado() {
        assertThat(CatalogoPermisos.definiciones()).hasSize(26);
        assertThat(CatalogoPermisos.definiciones()).allSatisfy(definicion -> {
            assertThat(definicion.nombre()).isNotBlank();
            assertThat(definicion.modulo()).isNotBlank();
            assertThat(definicion.descripcion()).isNotBlank();
        });
    }
}
