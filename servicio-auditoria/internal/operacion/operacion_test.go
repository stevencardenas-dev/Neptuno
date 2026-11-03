package operacion

import (
	"testing"
	"time"
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

func rango(desde, hasta int) []int {
	valores := make([]int, 0, hasta-desde+1)
	for i := desde; i <= hasta; i++ {
		valores = append(valores, i)
	}
	return valores
}
