package co.gov.neptuno.usuarios.comun;

/**
 * Origen de un documento según el formato de radicado AAAAMMDD + X + CONSECUTIVO,
 * donde X identifica el origen (1 = Interno, 2 = Externo, 3 = Recibido, 4 = No radicable).
 */
public enum OrigenDocumento {
    INTERNO(1, "Interno"),
    EXTERNO(2, "Externo"),
    RECIBIDO(3, "Recibido"),
    NO_RADICABLE(4, "No radicable");

    private final int digito;
    private final String etiqueta;

    OrigenDocumento(int digito, String etiqueta) {
        this.digito = digito;
        this.etiqueta = etiqueta;
    }

    public int digito() {
        return digito;
    }

    public String etiqueta() {
        return etiqueta;
    }
}
