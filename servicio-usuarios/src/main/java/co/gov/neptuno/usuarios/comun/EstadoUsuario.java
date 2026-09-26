package co.gov.neptuno.usuarios.comun;

/** Estado de un usuario del sistema (HU-005: la baja lógica deja el usuario Inactivo). */
public enum EstadoUsuario {
    ACTIVO("Activo"),
    INACTIVO("Inactivo");

    private final String etiqueta;

    EstadoUsuario(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    /** Etiqueta usada por el frontend (Activo / Inactivo). */
    public String etiqueta() {
        return etiqueta;
    }
}
