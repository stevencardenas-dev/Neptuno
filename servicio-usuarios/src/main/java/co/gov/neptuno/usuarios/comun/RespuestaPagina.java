package co.gov.neptuno.usuarios.comun;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/** Envoltura de respuestas paginadas usada por los listados (HU-006, HU-010, HU-023). */
public record RespuestaPagina<T>(
        List<T> contenido,
        int pagina,
        int tamano,
        long total,
        int totalPaginas) {

    public static <E, T> RespuestaPagina<T> de(Page<E> pagina, Function<E, T> mapeador) {
        return new RespuestaPagina<>(
                pagina.getContent().stream().map(mapeador).toList(),
                pagina.getNumber(),
                pagina.getSize(),
                pagina.getTotalElements(),
                pagina.getTotalPages());
    }
}
