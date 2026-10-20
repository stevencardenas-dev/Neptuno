package bitacora

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"neptuno/auditoria/internal/comun"
	"neptuno/auditoria/internal/config"
)

// nombreConsumidor identifica a este consumidor en el broker.
const nombreConsumidor = "servicio-auditoria"

// Consumidor lee la cola audit.infrastructure y encadena cada evento (HU-043).
//
// Un solo consumidor con prefetch 1: la cadena se escribe en el orden en que los eventos
// llegaron al broker, que es el orden en que ocurrieron. El consumo es idempotente por
// evento_id, así que un mensaje reentregado no duplica nada.
type Consumidor struct {
	eventos  config.Eventos
	servicio *Servicio
}

// NuevoConsumidor construye el consumidor sobre su servicio.
func NuevoConsumidor(eventos config.Eventos, servicio *Servicio) *Consumidor {
	return &Consumidor{eventos: eventos, servicio: servicio}
}

// Consumir se conecta y procesa la cola hasta que se cancele el contexto.
//
// Reintenta la conexión con espera creciente: si el broker todavía no está, el servicio
// espera en vez de morir, porque los eventos no se pierden —quedan en el outbox del
// servicio que los emitió y se publican cuando vuelva la conexión—.
func (c *Consumidor) Consumir(ctx context.Context) error {
	espera := time.Second
	for {
		if ctx.Err() != nil {
			return nil
		}
		if err := c.sesion(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("se perdió la conexión con RabbitMQ; se reintenta",
				"cola", c.eventos.Cola, "error", err, "espera", espera.String())
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(espera):
		}
		if espera < 30*time.Second {
			espera *= 2
		}
	}
}

// sesion abre la conexión, declara la topología y consume hasta que el canal se cierre.
func (c *Consumidor) sesion(ctx context.Context) error {
	conexion, err := amqp.Dial(c.eventos.URL)
	if err != nil {
		return err
	}
	defer func() { _ = conexion.Close() }()

	canal, err := conexion.Channel()
	if err != nil {
		return err
	}
	defer func() { _ = canal.Close() }()

	// La topología la declaran también los servicios que publican; se declara aquí para
	// que el consumidor pueda arrancar primero sin perder mensajes.
	if err := canal.ExchangeDeclare(c.eventos.Exchange, "direct", true, false, false, false, nil); err != nil {
		return err
	}
	if _, err := canal.QueueDeclare(c.eventos.Cola, true, false, false, false, nil); err != nil {
		return err
	}
	if err := canal.QueueBind(c.eventos.Cola, c.eventos.RoutingKey, c.eventos.Exchange, false, nil); err != nil {
		return err
	}
	// Prefetch 1: se confirma un evento antes de recibir el siguiente. La cadena sigue el
	// orden de llegada y una caída no deja cien mensajes a medio encadenar.
	if err := canal.Qos(1, 0, false); err != nil {
		return err
	}
	entregas, err := canal.Consume(c.eventos.Cola, nombreConsumidor, false, false, false, false, nil)
	if err != nil {
		return err
	}
	slog.Info("escuchando la cola de bitácora", "cola", c.eventos.Cola, "exchange", c.eventos.Exchange)

	for {
		select {
		case <-ctx.Done():
			return nil
		case entrega, abierto := <-entregas:
			if !abierto {
				return errors.New("el canal de RabbitMQ se cerró")
			}
			c.procesar(ctx, entrega)
		}
	}
}

// procesar convierte el mensaje en un registro encadenado.
//
// Un mensaje inservible se descarta, no se reencola para siempre: si el evento no es
// JSON válido o no trae identificador, reintentarlo no lo va a arreglar. Un fallo de la
// base sí se reencola, porque el evento es bueno y solo hay que volver a intentarlo.
func (c *Consumidor) procesar(ctx context.Context, entrega amqp.Delivery) {
	var evento Evento
	if err := json.Unmarshal(entrega.Body, &evento); err != nil {
		slog.Error("evento descartado: no es JSON válido", "cola", c.eventos.Cola, "error", err)
		_ = entrega.Nack(false, false)
		return
	}

	registro, insertado, err := c.servicio.Registrar(ctx, evento)
	if err != nil {
		var api *comun.ErrorApi
		if errors.As(err, &api) {
			slog.Error("evento descartado", "motivo", api.Mensaje, "evento", evento.ID)
			_ = entrega.Nack(false, false)
			return
		}
		slog.Warn("no se pudo encadenar el evento; se reintenta", "evento", evento.ID, "error", err)
		_ = entrega.Nack(false, true)
		// Una pausa corta evita un ciclo apretado si la base está caída.
		time.Sleep(time.Second)
		return
	}

	if insertado {
		slog.Info("evento encadenado",
			"secuencia", registro.Secuencia,
			"tipo", registro.TipoEvento,
			"servicio", registro.ServicioOrigen)
	} else {
		slog.Debug("evento ya estaba en la bitácora", "evento", evento.ID)
	}
	_ = entrega.Ack(false)
}
