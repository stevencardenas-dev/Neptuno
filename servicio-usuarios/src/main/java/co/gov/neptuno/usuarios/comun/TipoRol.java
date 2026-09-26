package co.gov.neptuno.usuarios.comun;

/** Tipo de rol mostrado en la vista de Roles y permisos (HU-007). */
public enum TipoRol {
    SISTEMA("Sistema"),
    OPERATIVO("Operativo"),
    APROBADOR("Aprobador"),
    CONTROL("Control");

    private final String etiqueta;

    TipoRol(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String etiqueta() {
        return etiqueta;
    }
}
