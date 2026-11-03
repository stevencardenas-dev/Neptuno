package main

import "testing"

// HU-085: el veredicto de la prueba depende del p95, así que el percentil se fija con casos
// de borde: sin muestras, una sola, y el índice más cercano en 100 muestras.
func TestPercentil(t *testing.T) {
	cien := make([]int, 100)
	for i := range cien {
		cien[i] = i + 1
	}
	casos := []struct {
		nombre      string
		muestras    []int
		p, esperado int
	}{
		{"sin muestras", nil, 95, 0},
		{"una muestra", []int{40}, 99, 40},
		{"p95 de 1..100", cien, 95, 95},
		{"p99 de 1..100", cien, 99, 99},
		{"no depende del orden", []int{300, 10, 200}, 95, 300},
	}
	for _, c := range casos {
		if obtenido := percentil(c.muestras, c.p); obtenido != c.esperado {
			t.Errorf("%s: p%d = %d, se esperaba %d", c.nombre, c.p, obtenido, c.esperado)
		}
	}
}
