package bitacora

import (
	"database/sql"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// baseDePrueba construye un registro válido que cada prueba altera a su gusto.
func baseDePrueba() Registro {
	correo := "admin@neptuno.gov.co"
	entidadID := "8f14e45f-ceea-467a-9f2a-1b2c3d4e5f60"
	return Registro{
		EventoID:       "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		ServicioOrigen: "servicio-usuarios",
		TipoEvento:     "usuario.creado",
		Entidad:        "usuario",
		EntidadID:      &entidadID,
		ActorCorreo:    &correo,
		Detalle:        `"Se creó el usuario de prueba."`,
		OcurridoEn:     time.Date(2026, 10, 17, 11, 27, 0, 123456000, time.UTC),
		RecibidoEn:     time.Date(2026, 10, 17, 11, 27, 1, 0, time.UTC),
	}
}

// apunta devuelve un puntero a un texto, para los campos opcionales del registro.
func apunta(valor string) *string { return &valor }

// TestHashEsEstable comprueba que el mismo registro da siempre el mismo hash: es la
// condición para que la verificación pueda recalcularlo meses después.
func TestHashEsEstable(t *testing.T) {
	if Hash(baseDePrueba()) != Hash(baseDePrueba()) {
		t.Error("el hash del mismo registro cambió entre dos cálculos")
	}
}

// TestLaSecuenciaNoEntraEnElHash documenta una decisión de diseño. La columna es
// auto_increment y todavía no existe cuando se calcula el hash, así que no puede entrar
// en él. La posición no queda libre por eso: cada hash incluye el hash anterior y, por
// transitividad, compromete todo lo que vino antes.
func TestLaSecuenciaNoEntraEnElHash(t *testing.T) {
	original := baseDePrueba()
	otraSecuencia := original
	otraSecuencia.Secuencia = 999
	if Hash(otraSecuencia) != Hash(original) {
		t.Error("la secuencia no debería entrar en el hash")
	}
}

// TestHashCambiaConCualquierCampo comprueba que ninguna columna queda fuera del hash: la
// que se quedara fuera sería manipulable sin dejar rastro en la cadena.
func TestHashCambiaConCualquierCampo(t *testing.T) {
	original := baseDePrueba()
	esperado := Hash(original)

	alteraciones := map[string]func(*Registro){
		"evento_id":       func(r *Registro) { r.EventoID = "3f2504e0-4f89-11d3-9a0c-0305e82c3399" },
		"servicio_origen": func(r *Registro) { r.ServicioOrigen = "servicio-documentos" },
		"tipo_evento":     func(r *Registro) { r.TipoEvento = "usuario.editado" },
		"entidad":         func(r *Registro) { r.Entidad = "rol" },
		"entidad_id":      func(r *Registro) { r.EntidadID = apunta("otro-id") },
		"radicado_id":     func(r *Registro) { r.RadicadoID = apunta("8f14e45f-ceea-467a-9f2a-1b2c3d4e5f61") },
		"actor_id":        func(r *Registro) { r.ActorID = apunta("8f14e45f-ceea-467a-9f2a-1b2c3d4e5f62") },
		"actor_correo":    func(r *Registro) { r.ActorCorreo = apunta("otro@neptuno.gov.co") },
		"estado_anterior": func(r *Registro) { r.EstadoAnterior = apunta("RADICADO") },
		"estado_nuevo":    func(r *Registro) { r.EstadoNuevo = apunta("EN_TRAMITE") },
		"observacion":     func(r *Registro) { r.Observacion = apunta("otra observación") },
		"detalle":         func(r *Registro) { r.Detalle = `"Otro detalle."` },
		"ocurrido_en":     func(r *Registro) { r.OcurridoEn = r.OcurridoEn.Add(time.Second) },
		"recibido_en":     func(r *Registro) { r.RecibidoEn = r.RecibidoEn.Add(time.Second) },
		"hash_anterior":   func(r *Registro) { r.HashAnterior = apunta("00") },
	}

	for nombre, alterar := range alteraciones {
		copia := original
		alterar(&copia)
		if Hash(copia) == esperado {
			t.Errorf("alterar %s no cambió el hash: esa columna quedaría fuera de la cadena", nombre)
		}
	}
}

// TestCanonicoJSONNoDependeDelOrdenDeClaves: MySQL no garantiza el orden de las claves de
// una columna JSON, así que el hash se calcula sobre una forma canónica y no sobre el
// texto tal como llegó.
func TestCanonicoJSONNoDependeDelOrdenDeClaves(t *testing.T) {
	uno, err := CanonicoJSON(json.RawMessage(`{"b": 1, "a": 2}`))
	if err != nil {
		t.Fatalf("no se pudo canonizar: %v", err)
	}
	otro, err := CanonicoJSON(json.RawMessage(`{"a":2,     "b":1}`))
	if err != nil {
		t.Fatalf("no se pudo canonizar: %v", err)
	}
	if uno != otro {
		t.Errorf("el mismo documento dio dos formas distintas:\n%s\n%s", uno, otro)
	}
	if uno != `{"a":2,"b":1}` {
		t.Errorf("la forma canónica no ordenó las claves: %s", uno)
	}
}

// TestCanonicoJSONVacio cubre un evento sin detalle: la ausencia se representa siempre
// igual para que la cadena no dependa de cómo se escriba el vacío.
func TestCanonicoJSONVacio(t *testing.T) {
	for _, entrada := range []string{"", "null", "   ", "\t\n"} {
		texto, err := CanonicoJSON(json.RawMessage(entrada))
		if err != nil {
			t.Errorf("un detalle vacío (%q) no debería fallar: %v", entrada, err)
		}
		if texto != "" {
			t.Errorf("un detalle vacío (%q) debería quedar en blanco, quedó %q", entrada, texto)
		}
	}
}

// TestCanonicoJSONEsIdempotente es la propiedad de la que depende toda la verificación: al
// leer la fila se vuelve a canonizar el detalle; si eso cambiara el texto, la cadena
// parecería rota sin que nadie hubiera tocado nada.
func TestCanonicoJSONEsIdempotente(t *testing.T) {
	original := json.RawMessage(`{"z": [1, 2, {"y": "á"}], "a": "texto con \"comillas\""}`)
	primera, err := CanonicoJSON(original)
	if err != nil {
		t.Fatalf("no se pudo canonizar: %v", err)
	}
	segunda, err := CanonicoJSON(json.RawMessage(primera))
	if err != nil {
		t.Fatalf("no se pudo volver a canonizar: %v", err)
	}
	if primera != segunda {
		t.Errorf("canonizar dos veces cambió el texto:\n%s\n%s", primera, segunda)
	}
}

// TestDetalleDeLaFilaReproduceElTextoQueSeSello es la regresión del fallo que destapó el
// primer evento con detalle de objeto (flujo.creado, de ms-workflow-bpm): MySQL devuelve
// el texto de una columna JSON reescrito —claves ordenadas, con «, » y «: »—, así que al
// leer la fila hay que volver a la forma canónica antes de recalcular el hash. Con un
// detalle de tipo texto el ida y vuelta no cambia nada, y por eso el fallo no se vio
// antes: los 15 registros anteriores eran todos de texto.
func TestDetalleDeLaFilaReproduceElTextoQueSeSello(t *testing.T) {
	sellado, err := CanonicoJSON(json.RawMessage(
		`{"nombre":"Pago de cuentas de cobro","flujoId":"8be299ed-180f-4bae-929f-d7490f9930ae","cambios":["descripcion"]}`))
	if err != nil {
		t.Fatalf("no se pudo canonizar: %v", err)
	}
	if sellado != `{"cambios":["descripcion"],"flujoId":"8be299ed-180f-4bae-929f-d7490f9930ae","nombre":"Pago de cuentas de cobro"}` {
		t.Fatalf("el detalle sellado no quedó en forma canónica: %s", sellado)
	}

	// Así lo devuelve MySQL: el mismo contenido con otro texto.
	leido, err := detalleDeLaFila(sql.NullString{Valid: true, String: `{"cambios": ["descripcion"], "flujoId": "8be299ed-180f-4bae-929f-d7490f9930ae", "nombre": "Pago de cuentas de cobro"}`})
	if err != nil {
		t.Fatalf("no se pudo leer el detalle: %v", err)
	}
	if leido != sellado {
		t.Errorf("el detalle leído de MySQL no reproduce el sellado:\n%s\n%s", sellado, leido)
	}

	// Un detalle ausente sigue siendo ausencia, no el texto «null».
	vacio, err := detalleDeLaFila(sql.NullString{})
	if err != nil {
		t.Fatalf("un detalle ausente no debería fallar: %v", err)
	}
	if vacio != "" {
		t.Errorf("un detalle ausente debería quedar en blanco, quedó %q", vacio)
	}
}

// TestRegistroDesdeEventoTruncaLosInstantes: la columna guarda microsegundos. Si el hash
// se calculara con más precisión que la que la base conserva, la verificación fallaría
// por redondeo al leer la fila de vuelta.
func TestRegistroDesdeEventoTruncaLosInstantes(t *testing.T) {
	ocurrido := time.Date(2026, 10, 17, 11, 27, 0, 123456789, time.UTC)
	recibido := time.Date(2026, 10, 17, 11, 27, 1, 987654321, time.UTC)

	registro, err := RegistroDesdeEvento(Evento{
		ID:         "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		Tipo:       "radicado.creado",
		Entidad:    "radicado",
		Servicio:   "servicio-documentos",
		OcurridoEn: ocurrido,
		Detalle:    json.RawMessage(`"Se radicó la solicitud."`),
	}, recibido)
	if err != nil {
		t.Fatalf("no se pudo construir el registro: %v", err)
	}

	if registro.OcurridoEn.Nanosecond()%1000 != 0 {
		t.Errorf("la fecha no quedó truncada a microsegundos: %d ns", registro.OcurridoEn.Nanosecond())
	}
	texto := instante(registro.OcurridoEn).Format(formatoInstante)
	if !strings.HasSuffix(texto, ".123456Z") {
		t.Errorf("la fecha no se escribió con seis decimales: %s", texto)
	}
	// El hash debe ser el mismo antes y después del viaje por la base de datos.
	recuperado := registro
	recuperado.Secuencia = 7
	if Hash(recuperado) != Hash(registro) {
		t.Error("el hash cambió al recuperar el registro, y la verificación fallaría")
	}
}

// TestRegistroDesdeEventoDeduceElRadicado: HU-046 necesita el historial por documento, y
// el id del radicado se deduce del propio evento cuando la entidad afectada es un
// radicado.
func TestRegistroDesdeEventoDeduceElRadicado(t *testing.T) {
	radicadoID := "8f14e45f-ceea-467a-9f2a-1b2c3d4e5f70"
	recibido := time.Date(2026, 10, 17, 11, 27, 1, 0, time.UTC)

	radicado, err := RegistroDesdeEvento(Evento{
		ID: "3f2504e0-4f89-11d3-9a0c-0305e82c3301", Tipo: "radicado.creado",
		Entidad: "radicado", EntidadID: &radicadoID, OcurridoEn: recibido,
	}, recibido)
	if err != nil {
		t.Fatalf("no se pudo construir el registro: %v", err)
	}
	if radicado.RadicadoID == nil || *radicado.RadicadoID != radicadoID {
		t.Errorf("el radicado del evento no quedó enlazado al historial: %v", radicado.RadicadoID)
	}

	usuario, err := RegistroDesdeEvento(Evento{
		ID: "3f2504e0-4f89-11d3-9a0c-0305e82c3302", Tipo: "usuario.creado",
		Entidad: "usuario", EntidadID: &radicadoID, OcurridoEn: recibido,
	}, recibido)
	if err != nil {
		t.Fatalf("no se pudo construir el registro: %v", err)
	}
	if usuario.RadicadoID != nil {
		t.Error("un evento que no es de un radicado no debe aparecer en su historial")
	}
}

// TestCadenaDetectaUnaFilaBorrada arma la cadena como la arma el consumidor y comprueba
// que quitar una fila intermedia deja al siguiente apuntando a un hash que ya no está.
func TestCadenaDetectaUnaFilaBorrada(t *testing.T) {
	primero := baseDePrueba()
	segundo := baseDePrueba()
	segundo.EventoID = "3f2504e0-4f89-11d3-9a0c-0305e82c3302"
	tercero := baseDePrueba()
	tercero.EventoID = "3f2504e0-4f89-11d3-9a0c-0305e82c3303"

	cadena := armarCadena([]Registro{primero, segundo, tercero})
	if !enlazado(cadena[1].HashAnterior, &cadena[0].Hash) {
		t.Error("el segundo registro debería apuntar al primero")
	}
	if !enlazado(cadena[2].HashAnterior, &cadena[1].Hash) {
		t.Error("el tercer registro debería apuntar al segundo")
	}

	sinElMedio := []Registro{cadena[0], cadena[2]}
	if enlazado(sinElMedio[1].HashAnterior, &sinElMedio[0].Hash) {
		t.Error("borrar una fila intermedia debería romper la cadena")
	}
}

// TestCadenaDetectaUnaFilaAlterada: cambiar el contenido sin recalcular el hash es
// exactamente lo que la verificación tiene que notar.
func TestCadenaDetectaUnaFilaAlterada(t *testing.T) {
	cadena := armarCadena([]Registro{baseDePrueba()})

	alterada := cadena[0]
	alterada.Detalle = `"Detalle cambiado a mano en la base de datos."`
	if alterada.Hash == Hash(alterada) {
		t.Error("una fila alterada debería dejar de cuadrar con su hash")
	}
}

// armarCadena encadena los registros como lo hace el repositorio, sin base de datos.
func armarCadena(registros []Registro) []Registro {
	var anterior *string
	for indice := range registros {
		registros[indice].HashAnterior = anterior
		registros[indice].Hash = Hash(registros[indice])
		anterior = &registros[indice].Hash
	}
	return registros
}
