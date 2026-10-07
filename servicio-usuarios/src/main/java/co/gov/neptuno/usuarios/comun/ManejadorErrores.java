package co.gov.neptuno.usuarios.comun;

import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Traduce las excepciones del servicio a respuestas de error uniformes. */
@RestControllerAdvice
public class ManejadorErrores {

    private static final Logger registro = LoggerFactory.getLogger(ManejadorErrores.class);

    public record RespuestaError(String codigo, String mensaje, List<String> detalles, Instant momento) {
        static RespuestaError de(String codigo, String mensaje) {
            return new RespuestaError(codigo, mensaje, List.of(), Instant.now());
        }
    }

    @ExceptionHandler(ErroresApi.NoEncontrado.class)
    ResponseEntity<RespuestaError> noEncontrado(ErroresApi.NoEncontrado ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(RespuestaError.de("NO_ENCONTRADO", ex.getMessage()));
    }

    @ExceptionHandler(ErroresApi.Conflicto.class)
    ResponseEntity<RespuestaError> conflicto(ErroresApi.Conflicto ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(RespuestaError.de("CONFLICTO", ex.getMessage()));
    }

    @ExceptionHandler(ErroresApi.ReglaInvalida.class)
    ResponseEntity<RespuestaError> reglaInvalida(ErroresApi.ReglaInvalida ex) {
        return ResponseEntity.badRequest()
                .body(RespuestaError.de("SOLICITUD_INVALIDA", ex.getMessage()));
    }

    @ExceptionHandler(ErroresApi.CredencialesInvalidas.class)
    ResponseEntity<RespuestaError> credencialesInvalidas(ErroresApi.CredencialesInvalidas ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(RespuestaError.de("CREDENCIALES_INVALIDAS", ex.getMessage()));
    }

    @ExceptionHandler(ErroresApi.NoAutorizado.class)
    ResponseEntity<RespuestaError> noAutorizado(ErroresApi.NoAutorizado ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(RespuestaError.de("ACCESO_DENEGADO", ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<RespuestaError> accesoDenegado(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(RespuestaError.de("ACCESO_DENEGADO", "El usuario no tiene el permiso requerido para esta funcionalidad."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<RespuestaError> validacion(MethodArgumentNotValidException ex) {
        List<String> detalles = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .toList();
        return ResponseEntity.badRequest()
                .body(new RespuestaError("DATOS_INVALIDOS",
                        "No se permiten campos obligatorios vacíos ni valores inválidos.",
                        detalles, Instant.now()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<RespuestaError> cuerpoIlegible(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
                .body(RespuestaError.de("CUERPO_ILEGIBLE", "El cuerpo de la solicitud no tiene el formato esperado."));
    }

    /** Un identificador o un enum mal escrito en la URL (p. ej. /usuarios/abc). */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<RespuestaError> parametroInvalido(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest()
                .body(RespuestaError.de("PARAMETRO_INVALIDO", "El parámetro '" + ex.getName() + "' no tiene un valor válido."));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<RespuestaError> parametroFaltante(MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest()
                .body(RespuestaError.de("PARAMETRO_INVALIDO", "Falta el parámetro obligatorio '" + ex.getParameterName() + "'."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<RespuestaError> metodoNoPermitido(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(RespuestaError.de("METODO_NO_PERMITIDO", "El método " + ex.getMethod() + " no está permitido en esta ruta."));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<RespuestaError> rutaInexistente(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(RespuestaError.de("NO_ENCONTRADO", "La ruta solicitada no existe."));
    }

    /**
     * Último recurso: el cliente recibe un mensaje genérico con el mismo formato y el
     * detalle técnico queda solo en el log del servicio.
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<RespuestaError> inesperado(Exception ex) {
        registro.error("Error no controlado al atender la solicitud.", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(RespuestaError.de("ERROR_INTERNO", "Ocurrió un error inesperado. Intenta de nuevo más tarde."));
    }
}
