package operacion

import (
	"net/http"
	"strconv"
	"strings"

	"neptuno/auditoria/internal/comun"
)

// Permisos del catálogo de servicio-usuarios que protegen estas rutas.
const (
	PermisoRendimiento = "rendimiento:consultar"
)

// Manejadores expone el rendimiento por HTTP.
type Manejadores struct {
	servicio *Servicio
}

// NuevoManejadores construye los manejadores sobre el servicio de operación.
func NuevoManejadores(servicio *Servicio) *Manejadores {
	return &Manejadores{servicio: servicio}
}

// Registrar añade las rutas al enrutador compartido del servicio. Se registran sobre el
// mismo mux que la bitácora: un solo mux evita que dos `Handle("/")` se pisen.
func (m *Manejadores) Registrar(mux *http.ServeMux) {
	rendimiento := comun.RequierePermiso(PermisoRendimiento, m.resumenRendimiento)
	mux.HandleFunc("GET /api/auditoria/rendimiento", rendimiento)
	mux.HandleFunc("GET /api/auditoria/rendimiento/capturas", comun.RequierePermiso(PermisoRendimiento, m.listarCapturas))
	mux.HandleFunc("POST /api/auditoria/rendimiento/capturas", comun.RequierePermiso(PermisoRendimiento, m.capturar))
}

// resumenRendimiento devuelve los percentiles de lo observado en este proceso (HU-084).
func (m *Manejadores) resumenRendimiento(w http.ResponseWriter, r *http.Request) {
	mediciones := m.servicio.ResumenRendimiento("servicio-auditoria")
	comun.EscribirJSON(w, http.StatusOK, map[string]any{
		"limiteMs":   LimiteMs,
		"ventana":    "desde el arranque del servicio",
		"contenido":  mediciones,
		"total":      len(mediciones),
		"cumpleTodo": todosCumplen(mediciones),
	})
}

// capturar guarda la ventana actual para compararla después (HU-084).
func (m *Manejadores) capturar(w http.ResponseWriter, r *http.Request) {
	mediciones, err := m.servicio.CapturarRendimiento(r.Context(), "servicio-auditoria")
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusCreated, map[string]any{
		"contenido": mediciones,
		"total":     len(mediciones),
	})
}

// listarCapturas devuelve las ventanas guardadas (HU-084).
func (m *Manejadores) listarCapturas(w http.ResponseWriter, r *http.Request) {
	mediciones, err := m.servicio.ListarMediciones(r.Context(), r.URL.Query().Get("servicio"), leerLimite(r))
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusOK, map[string]any{
		"contenido": mediciones,
		"total":     len(mediciones),
	})
}

// leerLimite lee «limite» de la cadena de consulta, acotado.
func leerLimite(r *http.Request) int {
	valor := strings.TrimSpace(r.URL.Query().Get("limite"))
	if valor == "" {
		return 25
	}
	convertido, err := strconv.Atoi(valor)
	if err != nil || convertido <= 0 {
		return 25
	}
	return min(convertido, 200)
}

// todosCumplen dice si ninguna ruta superó el límite de 2 s en el p95.
func todosCumplen(mediciones []Medicion) bool {
	for _, medicion := range mediciones {
		if !medicion.Cumple {
			return false
		}
	}
	return true
}
