package operacion

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"neptuno/auditoria/internal/comun"
)

// Repositorio guarda la programación de respaldos, las ejecuciones, las restauraciones
// y las mediciones de rendimiento en la base propia del servicio.
type Repositorio struct {
	base *sql.DB
}

// NuevoRepositorio envuelve la conexión a audit_infra_db.
func NuevoRepositorio(base *sql.DB) *Repositorio { return &Repositorio{base: base} }

// Programacion devuelve la copia programada; si nunca se configuró, devuelve una con los
// valores por defecto para que la vista tenga qué mostrar.
func (r *Repositorio) Programacion(ctx context.Context) (Programacion, error) {
	const consulta = `select id, frecuencia, hora, retencion_dias, incluye_documentos,
		incluye_bitacora, activa, actualizado_por, actualizado_en
		from programacion_respaldo order by actualizado_en desc limit 1`
	var (
		programacion Programacion
		id           []byte
		actualizado  []byte
		hora         string
	)
	err := r.base.QueryRowContext(ctx, consulta).Scan(&id, &programacion.Frecuencia, &hora,
		&programacion.RetencionDias, &programacion.IncluyeDocumentos, &programacion.IncluyeBitacora,
		&programacion.Activa, &actualizado, &programacion.ActualizadoEn)
	if errors.Is(err, sql.ErrNoRows) {
		return Programacion{
			Frecuencia:        FrecuenciaDiaria,
			Hora:              "02:00",
			RetencionDias:     30,
			IncluyeDocumentos: true,
			IncluyeBitacora:   true,
			Activa:            true,
		}, nil
	}
	if err != nil {
		return Programacion{}, fmt.Errorf("no se pudo leer la programación de respaldos: %w", err)
	}
	if texto := aUUID(id); texto != nil {
		programacion.ID = *texto
	}
	if texto := aUUID(actualizado); texto != nil {
		programacion.ActualizadoPor = *texto
	}
	programacion.Hora = hora[:5]
	return programacion, nil
}

// GuardarProgramacion reemplaza la programación vigente. Solo existe una: se actualiza la
// fila si ya hay y se crea si no.
func (r *Repositorio) GuardarProgramacion(ctx context.Context, p Programacion, actor string) (Programacion, error) {
	actual, err := r.Programacion(ctx)
	if err != nil {
		return Programacion{}, err
	}
	p.ActualizadoPor = actor
	p.ActualizadoEn = time.Now().UTC()

	if actual.ID == "" {
		crudo, texto := nuevoUUID()
		p.ID = texto
		_, err = r.base.ExecContext(ctx, `insert into programacion_respaldo
			(id, frecuencia, hora, retencion_dias, incluye_documentos, incluye_bitacora, activa, actualizado_por, actualizado_en)
			values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			crudo, p.Frecuencia, p.Hora, p.RetencionDias, p.IncluyeDocumentos, p.IncluyeBitacora,
			p.Activa, aBinario(actor), p.ActualizadoEn)
	} else {
		p.ID = actual.ID
		_, err = r.base.ExecContext(ctx, `update programacion_respaldo
			set frecuencia = ?, hora = ?, retencion_dias = ?, incluye_documentos = ?,
			    incluye_bitacora = ?, activa = ?, actualizado_por = ?, actualizado_en = ?
			  where id = ?`,
			p.Frecuencia, p.Hora, p.RetencionDias, p.IncluyeDocumentos, p.IncluyeBitacora,
			p.Activa, aBinario(actor), p.ActualizadoEn, aBinario(p.ID))
	}
	if err != nil {
		return Programacion{}, fmt.Errorf("no se pudo guardar la programación de respaldos: %w", err)
	}
	return p, nil
}

// CrearRespaldo registra una ejecución que acaba de empezar.
func (r *Repositorio) CrearRespaldo(ctx context.Context, respaldo Respaldo, bases []string) (Respaldo, error) {
	crudo, texto := nuevoUUID()
	respaldo.ID = texto
	if respaldo.IniciadoEn.IsZero() {
		respaldo.IniciadoEn = time.Now().UTC()
	}
	if respaldo.Estado == "" {
		respaldo.Estado = RespaldoEnCurso
	}
	basesJSON, err := json.Marshal(bases)
	if err != nil {
		return Respaldo{}, fmt.Errorf("no se pudieron serializar las bases del respaldo: %w", err)
	}
	respaldo.BasesIncluidas = bases
	_, err = r.base.ExecContext(ctx, `insert into respaldo
		(id, programacion_id, estado, bases_incluidas, iniciado_por, iniciado_en, expira_en)
		values (?, ?, ?, ?, ?, ?, ?)`,
		crudo, binarioDe(respaldo.ProgramacionID), respaldo.Estado, string(basesJSON),
		binarioDe(respaldo.IniciadoPor), respaldo.IniciadoEn, respaldo.ExpiraEn)
	if err != nil {
		return Respaldo{}, fmt.Errorf("no se pudo registrar el respaldo: %w", err)
	}
	return respaldo, nil
}

// FinalizarRespaldo guarda el resultado de la ejecución.
func (r *Repositorio) FinalizarRespaldo(ctx context.Context, id, estado, ubicacion string, tamano int64, checksum, mensajeError string) error {
	_, err := r.base.ExecContext(ctx, `update respaldo
		set estado = ?, ubicacion = ?, tamano_bytes = ?, checksum_sha256 = ?,
		    finalizado_en = ?, mensaje_error = ?
		  where id = ?`,
		estado, nuloSiVacio(ubicacion), tamano, nuloSiVacio(checksum), time.Now().UTC(),
		nuloSiVacio(mensajeError), aBinario(id))
	if err != nil {
		return fmt.Errorf("no se pudo finalizar el respaldo: %w", err)
	}
	return nil
}

// ListarRespaldos devuelve las últimas ejecuciones, de la más reciente a la más antigua.
func (r *Repositorio) ListarRespaldos(ctx context.Context, limite int) ([]Respaldo, error) {
	const consulta = `select id, programacion_id, estado, bases_incluidas, ubicacion, tamano_bytes,
		checksum_sha256, iniciado_por, iniciado_en, finalizado_en, expira_en, mensaje_error
		from respaldo order by iniciado_en desc limit ?`
	filas, err := r.base.QueryContext(ctx, consulta, limite)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron listar los respaldos: %w", err)
	}
	defer func() { _ = filas.Close() }()

	respaldos := []Respaldo{}
	for filas.Next() {
		respaldo, err := leerRespaldo(filas)
		if err != nil {
			return nil, err
		}
		respaldos = append(respaldos, respaldo)
	}
	if err := filas.Err(); err != nil {
		return nil, fmt.Errorf("se interrumpió la lectura de los respaldos: %w", err)
	}
	return respaldos, nil
}

// ObtenerRespaldo devuelve un respaldo por su id.
func (r *Repositorio) ObtenerRespaldo(ctx context.Context, id string) (Respaldo, error) {
	const consulta = `select id, programacion_id, estado, bases_incluidas, ubicacion, tamano_bytes,
		checksum_sha256, iniciado_por, iniciado_en, finalizado_en, expira_en, mensaje_error
		from respaldo where id = ?`
	respaldo, err := leerRespaldo(r.base.QueryRowContext(ctx, consulta, aBinario(id)))
	if errors.Is(err, sql.ErrNoRows) {
		return Respaldo{}, comun.NoEncontrado("El respaldo no existe.")
	}
	if err != nil {
		return Respaldo{}, err
	}
	return respaldo, nil
}

// UltimoRespaldoDe programación: la última ejecución de la copia programada, para saber
// si ya se hizo la de hoy.
func (r *Repositorio) UltimoRespaldoDe(ctx context.Context, programacionID string) (*time.Time, error) {
	const consulta = `select iniciado_en from respaldo
		where programacion_id = ? order by iniciado_en desc limit 1`
	var iniciado time.Time
	err := r.base.QueryRowContext(ctx, consulta, aBinario(programacionID)).Scan(&iniciado)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("no se pudo leer el último respaldo programado: %w", err)
	}
	return &iniciado, nil
}

// RespaldosVencidos devuelve los completados cuyo plazo de retención ya pasó.
func (r *Repositorio) RespaldosVencidos(ctx context.Context, ahora time.Time) ([]Respaldo, error) {
	const consulta = `select id, programacion_id, estado, bases_incluidas, ubicacion, tamano_bytes,
		checksum_sha256, iniciado_por, iniciado_en, finalizado_en, expira_en, mensaje_error
		from respaldo where estado = 'COMPLETADO' and expira_en is not null and expira_en <= ?`
	filas, err := r.base.QueryContext(ctx, consulta, ahora)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron leer los respaldos vencidos: %w", err)
	}
	defer func() { _ = filas.Close() }()

	respaldos := []Respaldo{}
	for filas.Next() {
		respaldo, err := leerRespaldo(filas)
		if err != nil {
			return nil, err
		}
		respaldos = append(respaldos, respaldo)
	}
	return respaldos, errorsDe(filas)
}

// MarcarExpirado deja el respaldo fuera de la retención. La fila se conserva para que la
// vista pueda explicar qué se borró y cuándo.
func (r *Repositorio) MarcarExpirado(ctx context.Context, id string) error {
	_, err := r.base.ExecContext(ctx, "update respaldo set estado = 'EXPIRADO' where id = ?", aBinario(id))
	if err != nil {
		return fmt.Errorf("no se pudo marcar el respaldo como expirado: %w", err)
	}
	return nil
}

// CrearRestauracion registra la solicitud (HU-082).
func (r *Repositorio) CrearRestauracion(ctx context.Context, restauracion Restauracion) (Restauracion, error) {
	crudo, texto := nuevoUUID()
	restauracion.ID = texto
	restauracion.Estado = RestauracionSolicitada
	restauracion.SolicitadaEn = time.Now().UTC()
	_, err := r.base.ExecContext(ctx, `insert into restauracion
		(id, respaldo_id, estado, motivo, solicitada_por, solicitada_en)
		values (?, ?, ?, ?, ?, ?)`,
		crudo, aBinario(restauracion.RespaldoID), restauracion.Estado, restauracion.Motivo,
		aBinario(restauracion.SolicitadaPor), restauracion.SolicitadaEn)
	if err != nil {
		return Restauracion{}, fmt.Errorf("no se pudo registrar la solicitud de restauración: %w", err)
	}
	return restauracion, nil
}

// ListarRestauraciones devuelve las solicitudes, de la más reciente a la más antigua.
func (r *Repositorio) ListarRestauraciones(ctx context.Context, limite int) ([]Restauracion, error) {
	const consulta = `select id, respaldo_id, estado, motivo, solicitada_por, solicitada_en,
		confirmada_por, iniciada_en, finalizada_en, resultado
		from restauracion order by solicitada_en desc limit ?`
	filas, err := r.base.QueryContext(ctx, consulta, limite)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron listar las restauraciones: %w", err)
	}
	defer func() { _ = filas.Close() }()

	restauraciones := []Restauracion{}
	for filas.Next() {
		restauracion, err := leerRestauracion(filas)
		if err != nil {
			return nil, err
		}
		restauraciones = append(restauraciones, restauracion)
	}
	return restauraciones, errorsDe(filas)
}

// ObtenerRestauracion devuelve una solicitud por su id.
func (r *Repositorio) ObtenerRestauracion(ctx context.Context, id string) (Restauracion, error) {
	const consulta = `select id, respaldo_id, estado, motivo, solicitada_por, solicitada_en,
		confirmada_por, iniciada_en, finalizada_en, resultado
		from restauracion where id = ?`
	restauracion, err := leerRestauracion(r.base.QueryRowContext(ctx, consulta, aBinario(id)))
	if errors.Is(err, sql.ErrNoRows) {
		return Restauracion{}, comun.NoEncontrado("La restauración no existe.")
	}
	return restauracion, err
}

// IniciarRestauracion deja constancia de quién la confirmó y de que empezó.
func (r *Repositorio) IniciarRestauracion(ctx context.Context, id, confirmadaPor string) error {
	_, err := r.base.ExecContext(ctx, `update restauracion
		set estado = 'EN_CURSO', confirmada_por = ?, iniciada_en = ?
		  where id = ? and estado = 'SOLICITADA'`,
		aBinario(confirmadaPor), time.Now().UTC(), aBinario(id))
	if err != nil {
		return fmt.Errorf("no se pudo iniciar la restauración: %w", err)
	}
	return nil
}

// FinalizarRestauracion guarda si la restauración salió bien.
func (r *Repositorio) FinalizarRestauracion(ctx context.Context, id, estado, resultado string) error {
	_, err := r.base.ExecContext(ctx, `update restauracion
		set estado = ?, resultado = ?, finalizada_en = ? where id = ?`,
		estado, resultado, time.Now().UTC(), aBinario(id))
	if err != nil {
		return fmt.Errorf("no se pudo finalizar la restauración: %w", err)
	}
	return nil
}

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

func leerRespaldo(fila lector) (Respaldo, error) {
	var (
		respaldo     Respaldo
		id           []byte
		programacion []byte
		iniciadoPor  []byte
		basesCrudas  []byte
		tamano       sql.NullInt64
	)
	err := fila.Scan(&id, &programacion, &respaldo.Estado, &basesCrudas, &respaldo.Ubicacion,
		&tamano, &respaldo.ChecksumSHA256, &iniciadoPor, &respaldo.IniciadoEn,
		&respaldo.FinalizadoEn, &respaldo.ExpiraEn, &respaldo.MensajeError)
	if err != nil {
		return Respaldo{}, err
	}
	if texto := aUUID(id); texto != nil {
		respaldo.ID = *texto
	}
	respaldo.ProgramacionID = aUUID(programacion)
	respaldo.IniciadoPor = aUUID(iniciadoPor)
	if tamano.Valid {
		valor := tamano.Int64
		respaldo.TamanoBytes = &valor
	}
	respaldo.BasesIncluidas = []string{}
	if len(basesCrudas) > 0 {
		if err := json.Unmarshal(basesCrudas, &respaldo.BasesIncluidas); err != nil {
			return Respaldo{}, fmt.Errorf("no se pudieron leer las bases de un respaldo: %w", err)
		}
	}
	if respaldo.BasesIncluidas == nil {
		respaldo.BasesIncluidas = []string{}
	}
	return respaldo, nil
}

func leerRestauracion(fila lector) (Restauracion, error) {
	var (
		restauracion Restauracion
		id           []byte
		respaldo     []byte
		solicitante  []byte
		confirmo     []byte
	)
	err := fila.Scan(&id, &respaldo, &restauracion.Estado, &restauracion.Motivo, &solicitante,
		&restauracion.SolicitadaEn, &confirmo, &restauracion.IniciadaEn,
		&restauracion.FinalizadaEn, &restauracion.Resultado)
	if err != nil {
		return Restauracion{}, err
	}
	if texto := aUUID(id); texto != nil {
		restauracion.ID = *texto
	}
	if texto := aUUID(respaldo); texto != nil {
		restauracion.RespaldoID = *texto
	}
	if texto := aUUID(solicitante); texto != nil {
		restauracion.SolicitadaPor = *texto
	}
	restauracion.ConfirmadaPor = aUUID(confirmo)
	return restauracion, nil
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
