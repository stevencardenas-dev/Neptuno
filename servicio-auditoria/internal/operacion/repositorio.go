package operacion

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
)

// Repositorio guarda la programación de respaldos, las ejecuciones, las restauraciones
// y las mediciones de rendimiento en la base propia del servicio.
type Repositorio struct {
	base *sql.DB
}

// NuevoRepositorio envuelve la conexión a audit_infra_db.
func NuevoRepositorio(base *sql.DB) *Repositorio { return &Repositorio{base: base} }

// GuardarMediciones inserta una captura de tiempos de respuesta (HU-084).
func (r *Repositorio) GuardarMediciones(ctx context.Context, mediciones []Medicion) error {
	if len(mediciones) == 0 {
		return nil
	}
	transaccion, err := r.base.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("no se pudo abrir la transacción de mediciones: %w", err)
	}
	defer func() { _ = transaccion.Rollback() }()

	for _, medicion := range mediciones {
		id, _ := nuevoUUID()
		if medicion.LimiteMs <= 0 {
			medicion.LimiteMs = LimiteMs
		}
		if _, err := transaccion.ExecContext(ctx, `insert into medicion_rendimiento
			(id, servicio, metodo, ruta, ventana_desde, ventana_hasta, solicitudes, p50_ms, p95_ms, p99_ms, limite_ms)
			values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, medicion.Servicio, medicion.Metodo, medicion.Ruta, medicion.VentanaDesde,
			medicion.VentanaHasta, medicion.Solicitudes, medicion.P50Ms, medicion.P95Ms,
			medicion.P99Ms, medicion.LimiteMs); err != nil {
			return fmt.Errorf("no se pudo guardar una medición de rendimiento: %w", err)
		}
	}
	if err := transaccion.Commit(); err != nil {
		return fmt.Errorf("no se pudieron confirmar las mediciones: %w", err)
	}
	return nil
}

// ListarMediciones devuelve las capturas guardadas, de la más reciente a la más antigua.
func (r *Repositorio) ListarMediciones(ctx context.Context, servicio string, limite int) ([]Medicion, error) {
	consulta := `select id, servicio, metodo, ruta, ventana_desde, ventana_hasta, solicitudes,
		p50_ms, p95_ms, p99_ms, limite_ms, cumple from medicion_rendimiento`
	argumentos := []any{}
	if servicio != "" {
		consulta += " where servicio = ?"
		argumentos = append(argumentos, servicio)
	}
	consulta += " order by ventana_desde desc limit ?"
	argumentos = append(argumentos, limite)

	filas, err := r.base.QueryContext(ctx, consulta, argumentos...)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron listar las mediciones: %w", err)
	}
	defer func() { _ = filas.Close() }()

	mediciones := []Medicion{}
	for filas.Next() {
		var (
			medicion Medicion
			id       []byte
		)
		if err := filas.Scan(&id, &medicion.Servicio, &medicion.Metodo, &medicion.Ruta,
			&medicion.VentanaDesde, &medicion.VentanaHasta, &medicion.Solicitudes,
			&medicion.P50Ms, &medicion.P95Ms, &medicion.P99Ms, &medicion.LimiteMs,
			&medicion.Cumple); err != nil {
			return nil, fmt.Errorf("no se pudo leer una medición: %w", err)
		}
		if texto := aUUID(id); texto != nil {
			medicion.ID = *texto
		}
		mediciones = append(mediciones, medicion)
	}
	return mediciones, errorsDe(filas)
}

// lector es lo que comparten *sql.Row y *sql.Rows.
type lector interface {
	Scan(destino ...any) error
}

// decimalDe convierte el texto de una columna decimal, que el driver entrega en bytes.
func decimalDe(valor []byte) (float64, error) {
	if len(valor) == 0 {
		return 0, nil
	}
	return strconv.ParseFloat(string(valor), 64)
}

// nuloSiVacio guarda null cuando no hay valor.
func nuloSiVacio(valor string) any {
	if valor == "" {
		return nil
	}
	return valor
}

// binarioDe convierte un id opcional a la columna binaria.
func binarioDe(valor *string) any {
	if valor == nil || *valor == "" {
		return nil
	}
	return aBinario(*valor)
}

// errorsDe cierra la lectura y devuelve su error, si hubo.
func errorsDe(filas *sql.Rows) error {
	if err := filas.Err(); err != nil {
		return fmt.Errorf("se interrumpió la lectura: %w", err)
	}
	return nil
}
