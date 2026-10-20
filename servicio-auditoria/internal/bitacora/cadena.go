package bitacora

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"
)

// separador entre campos del texto canónico: un carácter de control que no aparece en
// los datos y que hace imposible confundir un campo con la continuación de otro.
const separador = "\u001f"

// formatoInstante fija la fecha en UTC con microsegundos, que es la precisión que
// conserva la columna datetime(6). Sin este formato el hash dependería de decimales que
// MySQL no guarda y la verificación fallaría por redondeo.
const formatoInstante = "2006-01-02T15:04:05.000000Z"

// Hash calcula el hash encadenado de un registro (HU-044): SHA-256 de la serialización
// canónica del registro junto con el hash del anterior. Cambiar cualquier fila, o
// borrar una intermedia, rompe la cadena desde ahí en adelante y la verificación lo
// señala.
func Hash(registro Registro) string {
	suma := sha256.Sum256([]byte(canonico(registro)))
	return hex.EncodeToString(suma[:])
}

// canonico serializa el registro de forma estable. La verificación recalcula este mismo
// texto a partir de lo que devuelve MySQL, así que no puede depender de nada que cambie
// entre escribir y leer: ni el orden de las claves del JSON, ni la zona horaria, ni los
// decimales de la fecha.
func canonico(registro Registro) string {
	campos := []string{
		registro.EventoID,
		registro.ServicioOrigen,
		registro.TipoEvento,
		registro.Entidad,
		textoODefecto(registro.EntidadID),
		textoODefecto(registro.RadicadoID),
		textoODefecto(registro.ActorID),
		textoODefecto(registro.ActorCorreo),
		textoODefecto(registro.EstadoAnterior),
		textoODefecto(registro.EstadoNuevo),
		textoODefecto(registro.Observacion),
		registro.Detalle,
		instante(registro.OcurridoEn).Format(formatoInstante),
		instante(registro.RecibidoEn).Format(formatoInstante),
		textoODefecto(registro.HashAnterior),
	}
	return strings.Join(campos, separador)
}

// CanonicoJSON re-serializa un documento JSON con las claves ordenadas. MySQL no
// garantiza el orden de las claves de una columna JSON, así que el hash no puede
// calcularse sobre el texto tal como llegó: se calcula sobre esta forma canónica, que se
// puede reproducir al leer la fila de vuelta. Un detalle ausente o nulo se resume en "".
func CanonicoJSON(crudo json.RawMessage) (string, error) {
	recortado := strings.TrimSpace(string(crudo))
	if recortado == "" || recortado == "null" {
		return "", nil
	}
	decodificador := json.NewDecoder(strings.NewReader(recortado))
	// UseNumber conserva el literal numérico: 1 sigue siendo 1 y 1.0 sigue siendo 1.0.
	decodificador.UseNumber()
	var valor any
	if err := decodificador.Decode(&valor); err != nil {
		return "", err
	}
	canonico, err := json.Marshal(valor)
	if err != nil {
		return "", err
	}
	return string(canonico), nil
}

// instante normaliza una fecha a UTC con microsegundos, la precisión de la columna.
func instante(fecha time.Time) time.Time {
	return fecha.UTC().Truncate(time.Microsecond)
}

// textoODefecto hace explícito un valor nulo para que la cadena canónica no dependa de
// cómo se represente la ausencia.
func textoODefecto(valor *string) string {
	if valor == nil || *valor == "" {
		return "-"
	}
	return *valor
}
