package co.gov.neptuno.usuarios.comun;

/** Excepciones de negocio del servicio, traducidas a códigos HTTP por el manejador global. */
public final class ErroresApi {

    private ErroresApi() {
    }

    /** 404: el recurso solicitado no existe. */
    public static class NoEncontrado extends RuntimeException {
        public NoEncontrado(String mensaje) {
            super(mensaje);
        }
    }

    /** 409: el recurso choca con el estado actual (correo duplicado, rol en uso, etc.). */
    public static class Conflicto extends RuntimeException {
        public Conflicto(String mensaje) {
            super(mensaje);
        }
    }

    /** 400: la solicitud viola una regla de negocio. */
    public static class ReglaInvalida extends RuntimeException {
        public ReglaInvalida(String mensaje) {
            super(mensaje);
        }
    }

    /** 403: el usuario autenticado no tiene el permiso requerido (HU-013). */
    public static class NoAutorizado extends RuntimeException {
        public NoAutorizado(String mensaje) {
            super(mensaje);
        }
    }

    /** 401: credenciales incorrectas en el inicio de sesión (HU-001). */
    public static class CredencialesInvalidas extends RuntimeException {
        public CredencialesInvalidas(String mensaje) {
            super(mensaje);
        }
    }
}
