package co.gov.neptuno.usuarios.comun;

/** Estado de un registro de catálogo maestro (áreas, tipos documentales, entidades). */
public enum EstadoCatalogo {
    ACTIVO("Activo"),
    INACTIVO("Inactivo");

    private final String etiqueta;

    EstadoCatalogo(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String etiqueta() {
        return etiqueta;
    }
}
