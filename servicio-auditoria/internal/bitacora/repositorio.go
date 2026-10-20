package bitacora

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/go-sql-driver/mysql"

	"neptuno/auditoria/internal/comun"
)

// claveBloqueo serializa la escritura de la cadena entre procesos. Dentro de un proceso
// el consumidor ya es único, pero el bloqueo deja el servicio a salvo si algún día se
// levantan dos réplicas: dos hashes calculados a la vez se encadenarían al mismo
// predecesor y romperían la cadena.
const claveBloqueo = "neptuno.bitacora"

// duplicado es el código de MySQL para una clave única repetida.
const duplicado = 1062

// columnas es el orden en el que se leen las filas; se usa en todas las consultas para
// que el escaneo de una fila esté en un solo sitio.
const columnas = `secuencia, evento_id, servicio_origen, tipo_evento, entidad, entidad_id,
	radicado_id, actor_id, actor_correo, estado_anterior, estado_nuevo, observacion,
	detalle, ocurrido_en, recibido_en, hash_anterior, hash`

// Repositorio guarda y lee la bitácora.
type Repositorio struct {
	base *sql.DB
}

// NuevoRepositorio envuelve la conexión a la base propia del servicio.
func NuevoRepositorio(base *sql.DB) *Repositorio { return &Repositorio{base: base} }

// Insertar añade un registro a la cadena.
//
// La posición y el hash se calculan dentro de la misma transacción que inserta, con el
// último hash bloqueado, de modo que nunca se encadenan dos registros al mismo
// predecesor aunque lleguen mensajes a la vez.
//
// Devuelve `insertado = false` cuando el evento ya estaba: así el consumidor puede
// recibir el mismo mensaje dos veces sin duplicar la bitácora (HU-043).
func (r *Repositorio) Insertar(ctx context.Context, registro Registro) (Registro, bool, error) {
	eventoBinario := aBinario(&registro.EventoID)
	if eventoBinario == nil {
		return Registro{}, false, fmt.Errorf("el evento %q no tiene un id uuid válido", registro.EventoID)
	}

	transaccion, err := r.base.BeginTx(ctx, nil)
	if err != nil {
		return Registro{}, false, fmt.Errorf("no se pudo abrir la transacción: %w", err)
	}
	defer func() { _ = transaccion.Rollback() }() // sin efecto cuando ya se confirmó

	var bloqueo sql.NullInt64
	if err := transaccion.QueryRowContext(ctx, "select get_lock(?, 10)", claveBloqueo).Scan(&bloqueo); err != nil {
		return Registro{}, false, fmt.Errorf("no se pudo tomar el bloqueo de la cadena: %w", err)
	}
	if !bloqueo.Valid || bloqueo.Int64 != 1 {
		return Registro{}, false, errors.New("la cadena de bitácora está ocupada por otro escritor")
	}

	anterior, err := ultimoHash(ctx, transaccion)
	if err != nil {
		return Registro{}, false, err
	}
	registro.HashAnterior = anterior
	registro.Hash = Hash(registro)

	resultado, err := transaccion.ExecContext(ctx, `
		insert into registro_bitacora (evento_id, servicio_origen, tipo_evento, entidad, entidad_id,
			radicado_id, actor_id, actor_correo, estado_anterior, estado_nuevo, observacion,
			detalle, ocurrido_en, recibido_en, hash_anterior, hash)
		values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		eventoBinario, registro.ServicioOrigen, registro.TipoEvento, registro.Entidad,
		registro.EntidadID, aBinario(registro.RadicadoID), aBinario(registro.ActorID),
		registro.ActorCorreo, registro.EstadoAnterior, registro.EstadoNuevo, registro.Observacion,
		nuloSiVacio(registro.Detalle), registro.OcurridoEn, registro.RecibidoEn,
		registro.HashAnterior, registro.Hash)
	if err != nil {
		if esDuplicado(err) {
			return Registro{}, false, nil
		}
		return Registro{}, false, fmt.Errorf("no se pudo insertar en la bitácora: %w", err)
	}

	secuencia, err := resultado.LastInsertId()
	if err != nil {
		return Registro{}, false, fmt.Errorf("no se pudo leer la secuencia asignada: %w", err)
	}
	if _, err := transaccion.ExecContext(ctx, "select release_lock(?)", claveBloqueo); err != nil {
		return Registro{}, false, fmt.Errorf("no se pudo liberar el bloqueo de la cadena: %w", err)
	}
	if err := transaccion.Commit(); err != nil {
		return Registro{}, false, fmt.Errorf("no se pudo confirmar la transacción: %w", err)
	}

	registro.Secuencia = secuencia
	return registro, true, nil
}

// ultimoHash devuelve el hash del último registro de la cadena, o nil si la bitácora
// está vacía: el primero de la cadena no tiene anterior.
func ultimoHash(ctx context.Context, transaccion *sql.Tx) (*string, error) {
	const consulta = `select hash from registro_bitacora order by secuencia desc limit 1 for update`
	var hash string
	err := transaccion.QueryRowContext(ctx, consulta).Scan(&hash)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("no se pudo leer el último hash de la cadena: %w", err)
	}
	return &hash, nil
}

// Listar devuelve una página de bitácora, de lo más reciente a lo más antiguo (HU-047).
func (r *Repositorio) Listar(ctx context.Context, filtros Filtros) (Pagina, error) {
	condiciones, argumentos := condicionesDe(filtros)
	donde := ""
	if len(condiciones) > 0 {
		donde = " where " + strings.Join(condiciones, " and ")
	}

	var total int
	if err := r.base.QueryRowContext(ctx,
		"select count(*) from registro_bitacora"+donde, argumentos...).Scan(&total); err != nil {
		return Pagina{}, fmt.Errorf("no se pudo contar la bitácora: %w", err)
	}

	consulta := "select " + columnas + " from registro_bitacora" + donde +
		" order by secuencia desc limit ? offset ?"
	argumentos = append(argumentos, filtros.Tamanio, filtros.Pagina*filtros.Tamanio)

	filas, err := r.base.QueryContext(ctx, consulta, argumentos...)
	if err != nil {
		return Pagina{}, fmt.Errorf("no se pudo consultar la bitácora: %w", err)
	}
	defer func() { _ = filas.Close() }()

	registros, err := leerRegistros(filas)
	if err != nil {
		return Pagina{}, err
	}
	return Pagina{
		Contenido: registros,
		Total:     total,
		Pagina:    filtros.Pagina,
		Tamanio:   filtros.Tamanio,
	}, nil
}

// Obtener devuelve un registro por su secuencia.
func (r *Repositorio) Obtener(ctx context.Context, secuencia int64) (Registro, error) {
	fila := r.base.QueryRowContext(ctx,
		"select "+columnas+" from registro_bitacora where secuencia = ?", secuencia)
	registro, err := leerRegistro(fila)
	if errors.Is(err, sql.ErrNoRows) {
		return Registro{}, comun.NoEncontrado("El registro de bitácora no existe.")
	}
	if err != nil {
		return Registro{}, fmt.Errorf("no se pudo leer el registro de bitácora: %w", err)
	}
	return registro, nil
}

// PorRadicado devuelve el historial de un documento, del hecho más antiguo al más
// reciente (HU-046).
func (r *Repositorio) PorRadicado(ctx context.Context, radicadoID string) ([]Registro, error) {
	binario := aBinario(&radicadoID)
	if binario == nil {
		return nil, comun.ReglaInvalida("El identificador del radicado no es válido.", radicadoID+" no es un uuid")
	}
	filas, err := r.base.QueryContext(ctx,
		"select "+columnas+" from registro_bitacora where radicado_id = ? order by secuencia asc", binario)
	if err != nil {
		return nil, fmt.Errorf("no se pudo consultar el historial del documento: %w", err)
	}
	defer func() { _ = filas.Close() }()
	return leerRegistros(filas)
}

// Recorrer recorre la cadena entera en orden y entrega cada registro a la función.
// Se lee en streaming a propósito: la bitácora crece sin límite y verificar no puede
// depender de que quepa en memoria.
func (r *Repositorio) Recorrer(ctx context.Context, porRegistro func(Registro) error) error {
	filas, err := r.base.QueryContext(ctx,
		"select "+columnas+" from registro_bitacora order by secuencia asc")
	if err != nil {
		return fmt.Errorf("no se pudo recorrer la bitácora: %w", err)
	}
	defer func() { _ = filas.Close() }()

	for filas.Next() {
		registro, err := leerRegistro(filas)
		if err != nil {
			return fmt.Errorf("no se pudo leer un registro de bitácora: %w", err)
		}
		if err := porRegistro(registro); err != nil {
			return err
		}
	}
	if err := filas.Err(); err != nil {
		return fmt.Errorf("se interrumpió la lectura de la bitácora: %w", err)
	}
	return nil
}

// Comprobar comprueba que la base responde y que la tabla de bitácora existe.
func (r *Repositorio) Comprobar(ctx context.Context) error {
	if err := r.base.PingContext(ctx); err != nil {
		return fmt.Errorf("la base de datos no responde: %w", err)
	}
	return r.comprobarTabla(ctx)
}

// Facetas devuelve los valores distintos que hoy hay en la bitácora, para los filtros
// de la vista (HU-047).
func (r *Repositorio) Facetas(ctx context.Context) (Facetas, error) {
	servicios, err := r.valoresDistintos(ctx, "servicio_origen", "")
	if err != nil {
		return Facetas{}, err
	}
	tipos, err := r.valoresDistintos(ctx, "tipo_evento", "")
	if err != nil {
		return Facetas{}, err
	}
	entidades, err := r.valoresDistintos(ctx, "entidad", "")
	if err != nil {
		return Facetas{}, err
	}
	actores, err := r.valoresDistintos(ctx, "actor_correo", "actor_correo is not null")
	if err != nil {
		return Facetas{}, err
	}
	return Facetas{Servicios: servicios, Tipos: tipos, Entidades: entidades, Actores: actores}, nil
}

// valoresDistintos lee una columna sin repetir. El nombre de la columna no viene de la
// petición: lo pasa una constante del código, nunca el usuario.
func (r *Repositorio) valoresDistintos(ctx context.Context, columna, condicion string) ([]string, error) {
	consulta := "select distinct " + columna + " from registro_bitacora"
	if condicion != "" {
		consulta += " where " + condicion
	}
	consulta += " order by 1 asc limit 100"

	filas, err := r.base.QueryContext(ctx, consulta)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron leer los valores de %s: %w", columna, err)
	}
	defer func() { _ = filas.Close() }()

	valores := []string{}
	for filas.Next() {
		var valor sql.NullString
		if err := filas.Scan(&valor); err != nil {
			return nil, fmt.Errorf("no se pudo leer un valor de %s: %w", columna, err)
		}
		if valor.Valid && valor.String != "" {
			valores = append(valores, valor.String)
		}
	}
	if err := filas.Err(); err != nil {
		return nil, fmt.Errorf("se interrumpió la lectura de %s: %w", columna, err)
	}
	return valores, nil
}

// condicionesDe traduce los filtros a SQL. Todo va parametrizado: lo que escribe el
// usuario nunca se concatena en la consulta.
func condicionesDe(filtros Filtros) ([]string, []any) {
	condiciones := []string{}
	argumentos := []any{}

	if filtros.Servicio != "" {
		condiciones = append(condiciones, "servicio_origen = ?")
		argumentos = append(argumentos, filtros.Servicio)
	}
	if filtros.TipoEvento != "" {
		condiciones = append(condiciones, "tipo_evento = ?")
		argumentos = append(argumentos, filtros.TipoEvento)
	}
	if filtros.Entidad != "" {
		condiciones = append(condiciones, "entidad = ?")
		argumentos = append(argumentos, filtros.Entidad)
	}
	if filtros.Actor != "" {
		// El actor se busca por correo o por id, para que la vista no tenga que saber cuál
		// de los dos tiene a mano.
		condiciones = append(condiciones, "(actor_correo = ? or actor_id = ?)")
		argumentos = append(argumentos, filtros.Actor, aBinario(&filtros.Actor))
	}
	if filtros.RadicadoID != "" {
		condiciones = append(condiciones, "radicado_id = ?")
		argumentos = append(argumentos, aBinario(&filtros.RadicadoID))
	}
	if filtros.Desde != nil {
		condiciones = append(condiciones, "ocurrido_en >= ?")
		argumentos = append(argumentos, instante(*filtros.Desde))
	}
	if filtros.Hasta != nil {
		condiciones = append(condiciones, "ocurrido_en <= ?")
		argumentos = append(argumentos, instante(*filtros.Hasta))
	}
	return condiciones, argumentos
}

// lector es lo que comparten *sql.Row y *sql.Rows para leer una fila.
type lector interface {
	Scan(destino ...any) error
}

// leerRegistro convierte una fila de MySQL al registro del dominio.
func leerRegistro(fila lector) (Registro, error) {
	var (
		registro     Registro
		eventoID     []byte
		radicado     []byte
		actor        []byte
		detalleCrudo sql.NullString
	)
	err := fila.Scan(
		&registro.Secuencia, &eventoID, &registro.ServicioOrigen, &registro.TipoEvento,
		&registro.Entidad, &registro.EntidadID, &radicado, &actor, &registro.ActorCorreo,
		&registro.EstadoAnterior, &registro.EstadoNuevo, &registro.Observacion,
		&detalleCrudo, &registro.OcurridoEn, &registro.RecibidoEn, &registro.HashAnterior, &registro.Hash,
	)
	if err != nil {
		return Registro{}, err
	}
	if texto := aUUID(eventoID); texto != nil {
		registro.EventoID = *texto
	}
	registro.RadicadoID = aUUID(radicado)
	registro.ActorID = aUUID(actor)
	detalle, err := detalleDeLaFila(detalleCrudo)
	if err != nil {
		return Registro{}, fmt.Errorf("no se pudo leer el detalle de un registro de bitácora: %w", err)
	}
	registro.Detalle = detalle
	return registro, nil
}

// detalleDeLaFila devuelve el detalle en la forma con la que se calculó su hash.
//
// MySQL reescribe el texto de una columna JSON —ordena las claves y separa con «, » y
// «: »—, así que lo que se lee no es lo que se selló. Con un detalle de tipo texto el
// ida y vuelta no cambia nada, y por eso el fallo pasó inadvertido hasta el primer
// evento con detalle de objeto (flujo.creado, de ms-workflow-bpm): la verificación
// recalculaba sobre otro texto y daba la cadena por rota sin que nadie hubiera tocado
// nada. Volver a canonizarlo aquí reproduce el texto original.
func detalleDeLaFila(valor sql.NullString) (string, error) {
	if !valor.Valid || valor.String == "" {
		return "", nil
	}
	return CanonicoJSON(json.RawMessage(valor.String))
}

// leerRegistros convierte todas las filas de un resultado.
func leerRegistros(filas *sql.Rows) ([]Registro, error) {
	registros := []Registro{}
	for filas.Next() {
		registro, err := leerRegistro(filas)
		if err != nil {
			return nil, fmt.Errorf("no se pudo leer un registro de bitácora: %w", err)
		}
		registros = append(registros, registro)
	}
	if err := filas.Err(); err != nil {
		return nil, fmt.Errorf("se interrumpió la lectura de la bitácora: %w", err)
	}
	return registros, nil
}

// nuloSiVacio guarda null cuando el evento no traía detalle.
func nuloSiVacio(valor string) any {
	if valor == "" {
		return nil
	}
	return valor
}

// esDuplicado reconoce la violación de clave única: el evento ya estaba encadenado.
func esDuplicado(err error) bool {
	var miError *mysql.MySQLError
	return errors.As(err, &miError) && miError.Number == duplicado
}
