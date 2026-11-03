// Comando carga: genera tráfico contra el sistema y resume los tiempos de respuesta
// (HU-085). Es una prueba de carga pequeña y sin dependencias, pensada para correr en el
// compose o desde una terminal:
//
//	go run ./cmd/carga -url http://localhost:8080/api/auditoria/bitacora \
//	    -token "$TOKEN" -usuarios 20 -duracion 30
//
// El resultado sale por la salida estándar, junto al límite de 2 s; si el p95 lo supera, el
// programa termina con código 2.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type resultado struct {
	Escenario            string  `json:"escenario"`
	Herramienta          string  `json:"herramienta"`
	UsuariosConcurrentes int     `json:"usuariosConcurrentes"`
	DuracionSegundos     int     `json:"duracionSegundos"`
	TotalSolicitudes     int     `json:"totalSolicitudes"`
	SolicitudesFallidas  int     `json:"solicitudesFallidas"`
	SolicitudesPorSeg    float64 `json:"solicitudesPorSegundo"`
	P95Ms                int     `json:"p95Ms"`
	P99Ms                int     `json:"p99Ms"`
	LimiteMs             int     `json:"limiteMs"`
	Cumple               bool    `json:"cumple"`
}

func main() {
	url := flag.String("url", "http://localhost:8080/api/auditoria/bitacora", "URL que se somete a carga")
	metodo := flag.String("metodo", "GET", "método HTTP")
	token := flag.String("token", "", "token de acceso (Bearer)")
	usuarios := flag.Int("usuarios", 10, "usuarios concurrentes")
	duracion := flag.Int("duracion", 20, "duración de la prueba en segundos")
	escenario := flag.String("escenario", "", "nombre del escenario; por defecto, el método y la ruta")
	flag.Parse()

	if *escenario == "" {
		*escenario = *metodo + " " + *url
	}
	res := ejecutar(*url, *metodo, *token, *usuarios, *duracion)
	res.Escenario = *escenario

	salida, _ := json.MarshalIndent(res, "", "  ")
	fmt.Println(string(salida))

	if !res.Cumple {
		// Un p95 por encima del límite es un fallo de la prueba, no un error del programa.
		os.Exit(2)
	}
}

// ejecutar lanza los usuarios concurrentes y recoge las latencias.
func ejecutar(url, metodo, token string, usuarios, duracion int) resultado {
	cliente := &http.Client{Timeout: 30 * time.Second}
	var (
		mu        sync.Mutex
		latencias []int
		total     atomic.Int64
		fallidas  atomic.Int64
	)
	limite, cancelar := context.WithTimeout(context.Background(), time.Duration(duracion)*time.Second)
	defer cancelar()

	var grupo sync.WaitGroup
	for i := 0; i < usuarios; i++ {
		grupo.Add(1)
		go func() {
			defer grupo.Done()
			for limite.Err() == nil {
				inicio := time.Now()
				peticion, err := http.NewRequestWithContext(limite, metodo, url, nil)
				if err != nil {
					fallidas.Add(1)
					total.Add(1)
					continue
				}
				if token != "" {
					peticion.Header.Set("Authorization", "Bearer "+token)
				}
				respuesta, err := cliente.Do(peticion)
				transcurrido := int(time.Since(inicio).Milliseconds())
				total.Add(1)
				if err != nil {
					fallidas.Add(1)
					continue
				}
				_, _ = io.Copy(io.Discard, respuesta.Body)
				_ = respuesta.Body.Close()
				if respuesta.StatusCode >= 400 {
					fallidas.Add(1)
				}
				mu.Lock()
				latencias = append(latencias, transcurrido)
				mu.Unlock()
			}
		}()
	}
	grupo.Wait()

	return resultado{
		Herramienta:          "GO",
		UsuariosConcurrentes: usuarios,
		DuracionSegundos:     duracion,
		TotalSolicitudes:     int(total.Load()),
		SolicitudesFallidas:  int(fallidas.Load()),
		SolicitudesPorSeg:    float64(total.Load()) / float64(duracion),
		P95Ms:                percentil(latencias, 95),
		P99Ms:                percentil(latencias, 99),
		LimiteMs:             2000,
		Cumple:               percentil(latencias, 95) <= 2000,
	}
}

// percentil devuelve el percentil pedido por el método del índice más cercano.
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
