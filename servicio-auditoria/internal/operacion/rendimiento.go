package operacion

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"neptuno/auditoria/internal/comun"
)

// muestrasMaximas acota lo que se guarda por ruta. La medición es una ventana móvil: con
// cien mil muestras sobra para un percentil estable y no crece sin control.
const muestrasMaximas = 100_000

// Colector acumula los tiempos de respuesta de este proceso (HU-084).
//
// Mide lo que ve el propio servicio, sin agente externo: es la fuente de las métricas de
// la vista y lo que se guarda como ventana cuando alguien lo pide. Al reiniciar el
// contenedor la medición empieza de cero; lo guardado en la base no se pierde.
type Colector struct {
	mu       sync.Mutex
	inicio   time.Time
	ventana  time.Duration
	muestras map[string][]int
}

// NuevoColector arranca un colector con la ventana indicada.
func NuevoColector(ventana time.Duration) *Colector {
	if ventana <= 0 {
		ventana = time.Hour
	}
	return &Colector{inicio: time.Now().UTC(), ventana: ventana, muestras: map[string][]int{}}
}

// Observar anota una duración para una ruta.
func (c *Colector) Observar(metodo, ruta string, duracion time.Duration) {
	clave := metodo + " " + ruta
	milisegundos := int(duracion.Milliseconds())
	if milisegundos < 0 {
		milisegundos = 0
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	muestras := c.muestras[clave]
	if len(muestras) >= muestrasMaximas {
		// Se descarta la mitad más antigua: la ventana sigue siendo representativa.
		muestras = append([]int{}, muestras[len(muestras)/2:]...)
	}
	c.muestras[clave] = append(muestras, milisegundos)
}

// Resumen devuelve una medición por ruta con los percentiles de lo observado.
func (c *Colector) Resumen(servicio string) []Medicion {
	c.mu.Lock()
	copias := make(map[string][]int, len(c.muestras))
	for clave, muestras := range c.muestras {
		copias[clave] = append([]int{}, muestras...)
	}
	desde := c.inicio
	c.mu.Unlock()

	ahora := time.Now().UTC()
	mediciones := []Medicion{}
	for clave, muestras := range copias {
		metodo, ruta, encontrado := strings.Cut(clave, " ")
		if !encontrado {
			ruta = clave
		}
		mediciones = append(mediciones, Medicion{
			Servicio:     servicio,
			Metodo:       metodo,
			Ruta:         ruta,
			VentanaDesde: desde,
			VentanaHasta: ahora,
			Solicitudes:  len(muestras),
			P50Ms:        percentil(muestras, 50),
			P95Ms:        percentil(muestras, 95),
			P99Ms:        percentil(muestras, 99),
			LimiteMs:     LimiteMs,
			Cumple:       percentil(muestras, 95) <= LimiteMs,
		})
	}
	sort.Slice(mediciones, func(i, j int) bool {
		if mediciones[i].Ruta == mediciones[j].Ruta {
			return mediciones[i].Metodo < mediciones[j].Metodo
		}
		return mediciones[i].Ruta < mediciones[j].Ruta
	})
	return mediciones
}

// Instrumentar mide cada solicitud que pasa por el manejador.
func (c *Colector) Instrumentar(siguiente http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inicio := time.Now()
		caja := &respuestaEnvuelta{ResponseWriter: w, estado: http.StatusOK}
		siguiente.ServeHTTP(caja, r)
		// El patrón es la ruta registrada («GET /api/auditoria/bitacora/{secuencia}»), no la
		// url concreta: si no, cada id sería una ruta distinta y las métricas no se agruparían.
		ruta := r.Pattern
		if ruta == "" {
			ruta = r.URL.Path
		}
		c.Observar(r.Method, ruta, time.Since(inicio))
	})
}

// respuestaEnvuelta recuerda el estado para no contar un 500 como si fuera un 200. El
// cuerpo pasa directo: las respuestas de la bitácora pueden ser grandes.
type respuestaEnvuelta struct {
	http.ResponseWriter
	estado int
}

func (r *respuestaEnvuelta) WriteHeader(estado int) {
	r.estado = estado
	r.ResponseWriter.WriteHeader(estado)
}

// Colector deja que el arranque del servicio instrumente su enrutador.
func (s *Servicio) Colector() *Colector { return s.colector }

// ResumenRendimiento devuelve la medición viva del proceso.
func (s *Servicio) ResumenRendimiento(servicio string) []Medicion {
	return s.colector.Resumen(servicio)
}

// CapturarRendimiento guarda la ventana actual en la base (HU-084), para que la vista
// pueda comparar contra capturas anteriores y no solo contra el proceso en curso.
func (s *Servicio) CapturarRendimiento(ctx context.Context, servicio string) ([]Medicion, error) {
	mediciones := s.colector.Resumen(servicio)
	if err := s.repositorio.GuardarMediciones(ctx, mediciones); err != nil {
		return nil, err
	}
	return mediciones, nil
}

// ListarMediciones devuelve las capturas guardadas.
func (s *Servicio) ListarMediciones(ctx context.Context, servicio string, limite int) ([]Medicion, error) {
	if limite <= 0 {
		limite = 100
	}
	return s.repositorio.ListarMediciones(ctx, servicio, limite)
}

// RegistrarPruebaCarga valida y guarda el resultado de una prueba (HU-085).
func (s *Servicio) RegistrarPruebaCarga(ctx context.Context, prueba PruebaCarga, actor string) (PruebaCarga, error) {
	prueba.Escenario = strings.TrimSpace(prueba.Escenario)
	if prueba.Escenario == "" {
		return PruebaCarga{}, comun.ReglaInvalida("La prueba de carga necesita un escenario.")
	}
	switch prueba.Herramienta {
	case "K6", "GATLING", "JMETER", "GO":
	default:
		return PruebaCarga{}, comun.ReglaInvalida("La herramienta debe ser K6, GATLING, JMETER o GO.",
			prueba.Herramienta+" no es una herramienta válida")
	}
	if prueba.UsuariosConcurrentes <= 0 {
		return PruebaCarga{}, comun.ReglaInvalida("La prueba necesita al menos un usuario concurrente.")
	}
	if prueba.DuracionSegundos <= 0 {
		return PruebaCarga{}, comun.ReglaInvalida("La prueba necesita una duración en segundos.")
	}
	if prueba.TotalSolicitudes <= 0 {
		return PruebaCarga{}, comun.ReglaInvalida("La prueba no registró solicitudes.")
	}
	if prueba.SolicitudesFallidas < 0 || prueba.SolicitudesFallidas > prueba.TotalSolicitudes {
		return PruebaCarga{}, comun.ReglaInvalida("Las solicitudes fallidas no pueden superar el total.")
	}
	if prueba.P95Ms < 0 || prueba.P99Ms < prueba.P95Ms {
		return PruebaCarga{}, comun.ReglaInvalida("El p99 no puede ser menor que el p95.")
	}
	if prueba.SolicitudesPorSeg <= 0 {
		prueba.SolicitudesPorSeg = float64(prueba.TotalSolicitudes) / float64(prueba.DuracionSegundos)
	}
	prueba.EjecutadaPor = actor
	return s.repositorio.CrearPruebaCarga(ctx, prueba)
}

// ListarPruebasCarga devuelve las pruebas ejecutadas.
func (s *Servicio) ListarPruebasCarga(ctx context.Context, limite int) ([]PruebaCarga, error) {
	if limite <= 0 {
		limite = 25
	}
	return s.repositorio.ListarPruebasCarga(ctx, limite)
}

// percentil devuelve el percentil pedido de una lista de milisegundos, sin modificar la
// lista original. Usa el método del índice más cercano, que es el que reportan k6 y
// JMeter: con pocas muestras no interpola valores que nadie midió.
func percentil(muestras []int, p int) int {
	if len(muestras) == 0 {
		return 0
	}
	ordenadas := append([]int{}, muestras...)
	sort.Ints(ordenadas)
	indice := (len(ordenadas)*p + 99) / 100
	if indice > 0 {
		indice--
	}
	if indice >= len(ordenadas) {
		indice = len(ordenadas) - 1
	}
	return ordenadas[indice]
}

// resumenTexto es una ayuda para los registros: «3 rutas, peor p95 41 ms».
func resumenTexto(mediciones []Medicion) string {
	peor := 0
	for _, medicion := range mediciones {
		if medicion.P95Ms > peor {
			peor = medicion.P95Ms
		}
	}
	return fmt.Sprintf("%d rutas, peor p95 %d ms", len(mediciones), peor)
}
