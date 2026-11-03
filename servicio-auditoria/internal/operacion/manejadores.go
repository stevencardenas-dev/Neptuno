package operacion

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"neptuno/auditoria/internal/comun"
)

// Permisos del catálogo de servicio-usuarios que protegen estas rutas.
const (
	PermisoRespaldos   = "respaldos:administrar"
	PermisoRendimiento = "rendimiento:consultar"
)

// Manejadores expone respaldos y rendimiento por HTTP.
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
	respaldos := comun.RequierePermiso(PermisoRespaldos, m.listarRespaldos)
	mux.HandleFunc("GET /api/auditoria/respaldos", respaldos)
	mux.HandleFunc("POST /api/auditoria/respaldos", comun.RequierePermiso(PermisoRespaldos, m.ejecutarRespaldo))
	mux.HandleFunc("GET /api/auditoria/respaldos/programacion", comun.RequierePermiso(PermisoRespaldos, m.programacion))
	mux.HandleFunc("PUT /api/auditoria/respaldos/programacion", comun.RequierePermiso(PermisoRespaldos, m.guardarProgramacion))
	mux.HandleFunc("GET /api/auditoria/respaldos/{id}", comun.RequierePermiso(PermisoRespaldos, m.detalleRespaldo))

	rendimiento := comun.RequierePermiso(PermisoRendimiento, m.resumenRendimiento)
	mux.HandleFunc("GET /api/auditoria/rendimiento", rendimiento)
	mux.HandleFunc("GET /api/auditoria/rendimiento/capturas", comun.RequierePermiso(PermisoRendimiento, m.listarCapturas))
	mux.HandleFunc("POST /api/auditoria/rendimiento/capturas", comun.RequierePermiso(PermisoRendimiento, m.capturar))
}

// programacion devuelve la copia programada (HU-081).
func (m *Manejadores) programacion(w http.ResponseWriter, r *http.Request) {
	programacion, err := m.servicio.Programacion(r.Context())
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusOK, programacion)
}

// guardarProgramacion cambia la frecuencia, la hora y la retención (HU-081).
func (m *Manejadores) guardarProgramacion(w http.ResponseWriter, r *http.Request) {
	var cuerpo Programacion
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024)).Decode(&cuerpo); err != nil {
		comun.EscribirError(w, comun.ReglaInvalida("El cuerpo de la solicitud no es JSON válido.", err.Error()))
		return
	}
	actor, _ := comun.ActorDe(r)
	programacion, err := m.servicio.GuardarProgramacion(r.Context(), cuerpo, actor.ID)
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusOK, programacion)
}

// listarRespaldos devuelve las ejecuciones recientes.
func (m *Manejadores) listarRespaldos(w http.ResponseWriter, r *http.Request) {
	respaldos, err := m.servicio.ListarRespaldos(r.Context(), leerLimite(r))
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusOK, map[string]any{
		"contenido": respaldos,
		"total":     len(respaldos),
	})
}

// ejecutarRespaldo lanza una copia manual (HU-081).
func (m *Manejadores) ejecutarRespaldo(w http.ResponseWriter, r *http.Request) {
	actor, _ := comun.ActorDe(r)
	respaldo, err := m.servicio.EjecutarRespaldo(r.Context(), actor.ID)
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusCreated, respaldo)
}

// detalleRespaldo devuelve una ejecución por su id.
func (m *Manejadores) detalleRespaldo(w http.ResponseWriter, r *http.Request) {
	respaldo, err := m.servicio.ObtenerRespaldo(r.Context(), r.PathValue("id"))
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusOK, respaldo)
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
