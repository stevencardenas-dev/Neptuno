// Package comun reúne lo que comparten todos los manejadores: el formato de error que
// ya interpreta el frontend y la validación del token de acceso.
package comun

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"
)

// ErrorApi replica el cuerpo de error de los otros servicios —{codigo, mensaje,
// detalles, momento}— para que el cliente del frontend lo trate igual.
type ErrorApi struct {
	Estado   int
	Codigo   string
	Mensaje  string
	Detalles []string
}

func (e *ErrorApi) Error() string { return e.Mensaje }

// NoEncontrado es un 404 de recurso inexistente.
func NoEncontrado(mensaje string) *ErrorApi {
	return &ErrorApi{Estado: http.StatusNotFound, Codigo: "NO_ENCONTRADO", Mensaje: mensaje}
}

// ReglaInvalida es un 400 de dato inválido, con el detalle por campo.
func ReglaInvalida(mensaje string, detalles ...string) *ErrorApi {
	return &ErrorApi{Estado: http.StatusBadRequest, Codigo: "REGLA_INVALIDA", Mensaje: mensaje, Detalles: detalles}
}

// NoAutenticado es un 401: falta el token o no sirve.
func NoAutenticado(mensaje string) *ErrorApi {
	return &ErrorApi{Estado: http.StatusUnauthorized, Codigo: "NO_AUTENTICADO", Mensaje: mensaje}
}

// Prohibido es un 403: hay sesión, pero al rol le falta el permiso (HU-013).
func Prohibido(mensaje string) *ErrorApi {
	return &ErrorApi{Estado: http.StatusForbidden, Codigo: "ACCESO_DENEGADO", Mensaje: mensaje}
}

type cuerpoError struct {
	Codigo   string   `json:"codigo"`
	Mensaje  string   `json:"mensaje"`
	Detalles []string `json:"detalles"`
	Momento  string   `json:"momento"`
}

// EscribirError traduce un error a la respuesta HTTP. Lo que no sea ErrorApi se
// responde como 500 y se registra: el detalle interno no se le muestra al cliente.
func EscribirError(w http.ResponseWriter, err error) {
	var api *ErrorApi
	if errors.As(err, &api) {
		EscribirJSON(w, api.Estado, cuerpoError{
			Codigo:   api.Codigo,
			Mensaje:  api.Mensaje,
			Detalles: detallesSeguros(api.Detalles),
			Momento:  momento(),
		})
		return
	}
	slog.Error("error inesperado", "error", err)
	EscribirJSON(w, http.StatusInternalServerError, cuerpoError{
		Codigo:   "ERROR_INTERNO",
		Mensaje:  "Ocurrió un error inesperado al procesar la solicitud.",
		Detalles: []string{},
		Momento:  momento(),
	})
}

// EscribirJSON escribe un cuerpo JSON con el estado indicado.
func EscribirJSON(w http.ResponseWriter, estado int, cuerpo any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(estado)
	if err := json.NewEncoder(w).Encode(cuerpo); err != nil {
		slog.Error("no se pudo escribir la respuesta", "error", err)
	}
}

// detallesSeguros evita que `detalles` salga como null, porque el cliente lo recorre.
func detallesSeguros(detalles []string) []string {
	if detalles == nil {
		return []string{}
	}
	return detalles
}

func momento() string { return time.Now().UTC().Format(time.RFC3339) }
