package operacion

import (
	"net/http"
	"testing"
	"time"

	"neptuno/auditoria/internal/comun"
)

// TestPercentil comprueba el método del índice más cercano, que es el que usan k6 y
// JMeter: el percentil pedido nunca inventa un valor que nadie midió.
func TestPercentil(t *testing.T) {
	casos := []struct {
		nombre    string
		muestras  []int
		percentil int
		esperado  int
	}{
		{"vacío", nil, 95, 0},
		{"una sola muestra", []int{42}, 95, 42},
		{"cien muestras", rango(1, 100), 95, 95},
		{"cien muestras p99", rango(1, 100), 99, 99},
		{"p50 con cuatro", []int{10, 20, 30, 40}, 50, 20},
		{"desordenadas", []int{40, 10, 30, 20}, 95, 40},
	}
	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			if obtenido := percentil(caso.muestras, caso.percentil); obtenido != caso.esperado {
				t.Fatalf("percentil(%v, %d) = %d, se esperaba %d",
					caso.muestras, caso.percentil, obtenido, caso.esperado)
			}
		})
	}
}

// TestPercentilNoModificaLaEntrada: la lista original queda intacta, porque el colector la
// sigue usando para la siguiente consulta.
func TestPercentilNoModificaLaEntrada(t *testing.T) {
	muestras := []int{3, 1, 2}
	_ = percentil(muestras, 95)
	if muestras[0] != 3 || muestras[1] != 1 || muestras[2] != 2 {
		t.Fatalf("percentil alteró la entrada: %v", muestras)
	}
}

// TestResumenMarcaElLimite: un p95 por encima de 2 s deja de cumplir.
func TestResumenMarcaElLimite(t *testing.T) {
	colector := NuevoColector(time.Hour)
	for i := 0; i < 100; i++ {
		colector.Observar("GET", "/api/auditoria/bitacora", 10*time.Millisecond)
	}
	rapido := colector.Resumen("servicio-auditoria")
	if len(rapido) != 1 || !rapido[0].Cumple || rapido[0].Solicitudes != 100 {
		t.Fatalf("resumen inesperado: %+v", rapido)
	}

	lento := NuevoColector(time.Hour)
	for i := 0; i < 100; i++ {
		lento.Observar("GET", "/api/auditoria/bitacora", 2500*time.Millisecond)
	}
	if resumen := lento.Resumen("servicio-auditoria"); resumen[0].Cumple {
		t.Fatalf("un p95 de 2500 ms no puede cumplir el límite de 2 s: %+v", resumen[0])
	}
}

// TestTocaCopiar cubre la programación diaria: solo dispara después de la hora y una vez
// por intervalo, aunque el servicio se reinicie.
func TestTocaCopiar(t *testing.T) {
	programacion := Programacion{Frecuencia: FrecuenciaDiaria, Hora: "02:00", Activa: true}
	ahora := time.Date(2026, 3, 10, 2, 30, 0, 0, time.UTC)

	if !tocaCopiar(programacion, nil, ahora) {
		t.Fatal("sin respaldos previos, a las 02:30 ya toca copiar")
	}

	antes := ahora.Add(-25 * time.Hour)
	if !tocaCopiar(programacion, &antes, ahora) {
		t.Fatal("pasadas 24 horas, toca copiar")
	}

	ayer := ahora.Add(-1 * time.Hour)
	if tocaCopiar(programacion, &ayer, ahora) {
		t.Fatal("la copia de hace una hora ya cumplió el intervalo")
	}

	manana := time.Date(2026, 3, 10, 1, 0, 0, 0, time.UTC)
	if tocaCopiar(programacion, nil, manana) {
		t.Fatal("antes de la hora programada no se copia")
	}
}

// TestRecortarNoParteCaracteres evita dejar un byte suelto de una tilde en la columna.
func TestRecortarNoParteCaracteres(t *testing.T) {
	recortado := recortar("restauración", 11)
	if recortado != "restauraci" {
		t.Fatalf("recorte inesperado: %q", recortado)
	}
	if recortado := recortar("corto", 20); recortado != "corto" {
		t.Fatalf("no debía recortar: %q", recortado)
	}
}

func rango(desde, hasta int) []int {
	valores := make([]int, 0, hasta-desde+1)
	for i := desde; i <= hasta; i++ {
		valores = append(valores, i)
	}
	return valores
}

// HU-082: una restauración solo se confirma si sigue solicitada y si quien confirma no es
// quien la pidió; el error de la segunda regla es un 403, no un 400.
func TestConfirmacionDeRestauracion(t *testing.T) {
	solicitada := Restauracion{Estado: RestauracionSolicitada, SolicitadaPor: "ana"}
	if err := validarConfirmacion(solicitada, "luis"); err != nil {
		t.Fatalf("otra persona debería poder confirmar: %v", err)
	}
	err := validarConfirmacion(solicitada, "ana")
	api, ok := err.(*comun.ErrorApi)
	if !ok || api.Estado != http.StatusForbidden {
		t.Fatalf("quien pidió no puede confirmar (403), obtuvo %v", err)
	}
	for _, estado := range []string{RestauracionEnCurso, RestauracionCompletada, RestauracionFallida, RestauracionCancelada} {
		err := validarConfirmacion(Restauracion{Estado: estado, SolicitadaPor: "ana"}, "luis")
		api, ok := err.(*comun.ErrorApi)
		if !ok || api.Estado != http.StatusBadRequest {
			t.Errorf("en estado %s no se ejecuta (400), obtuvo %v", estado, err)
		}
	}
}
