// Package bitacora implementa la bitácora inalterable del sistema (HU-043…HU-047):
// consume los eventos que publican los demás servicios, los encadena por hash y los
// expone para consulta, historial por documento y filtros.
package bitacora

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Evento es el mensaje que los otros servicios publican en la cola
// audit.infrastructure con el patrón outbox. Es un contrato compartido:
// servicio-usuarios y servicio-documentos lo emiten y aquí solo se lee.
type Evento struct {
	ID          string          `json:"id"`
	Tipo        string          `json:"tipo"`
	Entidad     string          `json:"entidad"`
	EntidadID   *string         `json:"entidadId"`
	ActorID     *string         `json:"actorId"`
	ActorCorreo *string         `json:"actorCorreo"`
	Detalle     json.RawMessage `json:"detalle"`
	OcurridoEn  time.Time       `json:"ocurridoEn"`
	Servicio    string          `json:"servicio"`

	// HU-045: los emite quien cambia un estado. Hoy ningún servicio lo hace todavía
	// —el flujo de trabajo es el que moverá estados—, así que llegan nulos.
	EstadoAnterior *string `json:"estadoAnterior"`
	EstadoNuevo    *string `json:"estadoNuevo"`
	Observacion    *string `json:"observacion"`
}

// Registro es una fila de registro_bitacora ya encadenada (HU-044).
//
// La secuencia no entra en el hash: la columna es auto_increment y todavía no existe
// cuando se calcula. La posición queda comprometida igual, porque cada hash incluye el
// hash anterior y, por transitividad, todo lo que vino antes.
type Registro struct {
	Secuencia      int64     `json:"secuencia"`
	EventoID       string    `json:"eventoId"`
	ServicioOrigen string    `json:"servicioOrigen"`
	TipoEvento     string    `json:"tipoEvento"`
	Entidad        string    `json:"entidad"`
	EntidadID      *string   `json:"entidadId"`
	RadicadoID     *string   `json:"radicadoId"`
	ActorID        *string   `json:"actorId"`
	ActorCorreo    *string   `json:"actorCorreo"`
	EstadoAnterior *string   `json:"estadoAnterior"`
	EstadoNuevo    *string   `json:"estadoNuevo"`
	Observacion    *string   `json:"observacion"`
	Detalle        string    `json:"detalle"` // JSON canónico; "" cuando el evento no trae detalle
	OcurridoEn     time.Time `json:"ocurridoEn"`
	RecibidoEn     time.Time `json:"recibidoEn"`
	HashAnterior   *string   `json:"hashAnterior"`
	Hash           string    `json:"hash"`
}

// Filtros de la consulta de bitácora (HU-047).
type Filtros struct {
	Servicio   string
	TipoEvento string
	Entidad    string
	Actor      string // correo del actor o su id
	RadicadoID string
	Desde      *time.Time
	Hasta      *time.Time
	Pagina     int
	Tamanio    int
}

// FiltraLaBusqueda indica si se está acotando la búsqueda más allá de mirar una página.
// De eso depende el permiso que se exige: consultar la bitácora es bitacora:consultar y
// filtrarla es bitacora:filtrar (HU-046, HU-047), así que un rol puede tener el derecho
// de mirar sin el de acotar.
//
// El radicado no cuenta como filtro: pedir los hechos de un documento es el historial
// (HU-046), no una búsqueda, y lo cubre el mismo permiso de consultar.
func (f Filtros) FiltraLaBusqueda() bool {
	return f.Servicio != "" || f.TipoEvento != "" || f.Entidad != "" || f.Actor != "" ||
		f.Desde != nil || f.Hasta != nil
}

// Pagina es la respuesta paginada, con los mismos nombres que servicio-documentos.
type Pagina struct {
	Contenido []Registro `json:"contenido"`
	Total     int        `json:"total"`
	Pagina    int        `json:"pagina"`
	Tamanio   int        `json:"tamanio"`
}

// Facetas son los valores que hoy existen en la bitácora. Alimentan los filtros de la
// vista para que se elija de una lista en lugar de escribir el valor exacto, que es como
// el servicio compara (HU-047).
type Facetas struct {
	Servicios []string `json:"servicios"`
	Tipos     []string `json:"tipos"`
	Entidades []string `json:"entidades"`
	Actores   []string `json:"actores"`
}

// RegistroDesdeEvento traduce el mensaje publicado al registro que se encadena.
//
// El radicado se deduce del propio evento: cuando la entidad afectada es un radicado,
// su id es el del historial del documento (HU-046). Los demás agregados guardan su id
// en entidad_id, que no es una columna de radicado.
func RegistroDesdeEvento(evento Evento, recibidoEn time.Time) (Registro, error) {
	detalle, err := CanonicoJSON(evento.Detalle)
	if err != nil {
		return Registro{}, fmt.Errorf("el detalle del evento %s no es JSON válido: %w", evento.ID, err)
	}
	servicio := strings.TrimSpace(evento.Servicio)
	if servicio == "" {
		servicio = "desconocido"
	}
	registro := Registro{
		EventoID:       evento.ID,
		ServicioOrigen: servicio,
		TipoEvento:     evento.Tipo,
		Entidad:        evento.Entidad,
		EntidadID:      evento.EntidadID,
		ActorID:        evento.ActorID,
		ActorCorreo:    evento.ActorCorreo,
		EstadoAnterior: evento.EstadoAnterior,
		EstadoNuevo:    evento.EstadoNuevo,
		Observacion:    evento.Observacion,
		Detalle:        detalle,
		OcurridoEn:     instante(evento.OcurridoEn),
		RecibidoEn:     instante(recibidoEn),
	}
	if strings.EqualFold(registro.Entidad, "radicado") {
		registro.RadicadoID = registro.EntidadID
	}
	return registro, nil
}

// aBinario convierte un uuid textual a los 16 bytes de una columna binary(16).
// Devuelve nil cuando el valor no es un uuid: entidad_id es texto libre y las columnas
// binarias solo aceptan identificadores.
func aBinario(valor *string) []byte {
	if valor == nil {
		return nil
	}
	limpio := strings.ReplaceAll(strings.TrimSpace(*valor), "-", "")
	if len(limpio) != 32 {
		return nil
	}
	crudo, err := hex.DecodeString(limpio)
	if err != nil {
		return nil
	}
	return crudo
}

// aUUID vuelve de los 16 bytes al texto con guiones, que es como lo expone el API.
func aUUID(crudo []byte) *string {
	if len(crudo) != 16 {
		return nil
	}
	texto := hex.EncodeToString(crudo)
	conGuiones := texto[0:8] + "-" + texto[8:12] + "-" + texto[12:16] + "-" + texto[16:20] + "-" + texto[20:]
	return &conGuiones
}
