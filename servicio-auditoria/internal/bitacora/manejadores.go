package bitacora

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"neptuno/auditoria/internal/comun"
)

// Permisos del catálogo de servicio-usuarios (CatalogoPermisos). Consultar la bitácora y
// acotar la búsqueda son permisos distintos: HU-046 y HU-047.
const (
	PermisoConsultar = "bitacora:consultar"
	PermisoFiltrar   = "bitacora:filtrar"
)

// tamanioPagina es el tamaño por defecto de una página de bitácora.
const tamanioPagina = 25

// tamanioMaximo acota lo que se puede pedir: la bitácora crece sin límite y una respuesta
// enorme no le sirve a nadie.
const tamanioMaximo = 200

// Manejadores expone la bitácora por HTTP.
type Manejadores struct {
	servicio *Servicio
}

// NuevoManejadores construye los manejadores sobre su servicio.
func NuevoManejadores(servicio *Servicio) *Manejadores {
	return &Manejadores{servicio: servicio}
}

// Rutas arma el enrutador de las rutas protegidas. Los patrones con método y comodín son
// del net/http moderno, así que no hace falta traer un enrutador externo.
func (m *Manejadores) Rutas() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/auditoria/bitacora", comun.RequierePermiso(PermisoConsultar, m.listar))
	mux.HandleFunc("GET /api/auditoria/bitacora/verificacion", comun.RequierePermiso(PermisoConsultar, m.verificacion))
	mux.HandleFunc("GET /api/auditoria/bitacora/facetas", comun.RequierePermiso(PermisoConsultar, m.facetas))
	mux.HandleFunc("GET /api/auditoria/bitacora/radicado/{id}", comun.RequierePermiso(PermisoConsultar, m.historial))
	mux.HandleFunc("GET /api/auditoria/bitacora/{secuencia}", comun.RequierePermiso(PermisoConsultar, m.detalle))
	return mux
}

// facetas alimenta los filtros de la vista con los valores que hoy existen (HU-047).
func (m *Manejadores) facetas(w http.ResponseWriter, r *http.Request) {
	facetas, err := m.servicio.Facetas(r.Context())
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusOK, facetas)
}

// Salud responde al healthcheck del contenedor. Comprueba también la base: un servicio de
// bitácora sin base no puede encadenar ni consultar nada.
func (m *Manejadores) Salud(w http.ResponseWriter, r *http.Request) {
	if err := m.servicio.Comprobar(r.Context()); err != nil {
		comun.EscribirJSON(w, http.StatusServiceUnavailable, map[string]any{
			"estado":   "degradado",
			"servicio": "servicio-auditoria",
			"detalle":  err.Error(),
		})
		return
	}
	comun.EscribirJSON(w, http.StatusOK, map[string]any{
		"estado":   "ok",
		"servicio": "servicio-auditoria",
	})
}

// listar devuelve la bitácora paginada (HU-046) y filtrada (HU-047).
func (m *Manejadores) listar(w http.ResponseWriter, r *http.Request) {
	filtros, err := leerFiltros(r)
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	// HU-047: acotar la búsqueda por usuario, fecha o acción es un permiso aparte del de
	// consultar la bitácora, así que se comprueba solo cuando de verdad se está filtrando.
	if filtros.FiltraLaBusqueda() {
		actor, _ := comun.ActorDe(r)
		if !actor.Tiene(PermisoFiltrar) {
			comun.EscribirError(w, comun.Prohibido("Requiere el permiso "+PermisoFiltrar+" para acotar la búsqueda."))
			return
		}
	}
	pagina, err := m.servicio.Listar(r.Context(), filtros)
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusOK, pagina)
}

// verificacion recorre la cadena y dice si sigue íntegra (HU-044).
func (m *Manejadores) verificacion(w http.ResponseWriter, r *http.Request) {
	resultado, err := m.servicio.Verificar(r.Context())
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusOK, resultado)
}

// historial devuelve los hechos de un documento concreto (HU-046).
func (m *Manejadores) historial(w http.ResponseWriter, r *http.Request) {
	radicadoID := r.PathValue("id")
	registros, err := m.servicio.Historial(r.Context(), radicadoID)
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusOK, map[string]any{
		"radicadoId": radicadoID,
		"contenido":  registros,
		"total":      len(registros),
	})
}

// detalle devuelve un registro de la bitácora por su secuencia.
func (m *Manejadores) detalle(w http.ResponseWriter, r *http.Request) {
	secuencia, err := strconv.ParseInt(r.PathValue("secuencia"), 10, 64)
	if err != nil {
		comun.EscribirError(w, comun.ReglaInvalida("La secuencia debe ser un número entero."))
		return
	}
	registro, err := m.servicio.Obtener(r.Context(), secuencia)
	if err != nil {
		comun.EscribirError(w, err)
		return
	}
	comun.EscribirJSON(w, http.StatusOK, registro)
}

// leerFiltros lee los filtros de la cadena de consulta.
func leerFiltros(r *http.Request) (Filtros, error) {
	parametros := r.URL.Query()
	filtros := Filtros{
		Servicio:   strings.TrimSpace(parametros.Get("servicio")),
		TipoEvento: strings.TrimSpace(parametros.Get("tipo")),
		Entidad:    strings.TrimSpace(parametros.Get("entidad")),
		Actor:      strings.TrimSpace(parametros.Get("actor")),
		RadicadoID: strings.TrimSpace(parametros.Get("radicadoId")),
		Tamanio:    tamanioPagina,
	}

	pagina, err := numero(parametros.Get("pagina"), 0)
	if err != nil {
		return Filtros{}, comun.ReglaInvalida("La página debe ser un número entero.", err.Error())
	}
	filtros.Pagina = pagina

	tamanio, err := numero(parametros.Get("tamanio"), tamanioPagina)
	if err != nil {
		return Filtros{}, comun.ReglaInvalida("El tamaño de página debe ser un número entero.", err.Error())
	}
	if tamanio > 0 {
		filtros.Tamanio = min(tamanio, tamanioMaximo)
	}

	if filtros.Desde, err = leerFecha(parametros.Get("desde"), false); err != nil {
		return Filtros{}, err
	}
	if filtros.Hasta, err = leerFecha(parametros.Get("hasta"), true); err != nil {
		return Filtros{}, err
	}
	return filtros, nil
}

// leerFecha acepta AAAA-MM-DD, que es como la vista pide el rango con un calendario. En
// «hasta» se toma el día completo, para que el filtro incluya el último día elegido.
func leerFecha(valor string, finDeDia bool) (*time.Time, error) {
	if valor == "" {
		return nil, nil
	}
	dia, err := time.ParseInLocation("2006-01-02", valor, time.UTC)
	if err != nil {
		return nil, comun.ReglaInvalida("La fecha debe tener el formato AAAA-MM-DD.", valor+" no es una fecha válida")
	}
	if finDeDia {
		dia = dia.Add(24*time.Hour - time.Microsecond)
	}
	return &dia, nil
}

// numero convierte un parámetro entero; el vacío usa el valor por defecto.
func numero(valor string, porDefecto int) (int, error) {
	if valor == "" {
		return porDefecto, nil
	}
	convertido, err := strconv.Atoi(valor)
	if err != nil || convertido < 0 {
		return 0, fmt.Errorf("%q no es un número válido", valor)
	}
	return convertido, nil
}
