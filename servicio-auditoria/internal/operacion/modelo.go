// Package operacion reúne los requerimientos no funcionales de ms-audit-infra:
// copias de seguridad programadas (HU-081), medición de
// tiempos de respuesta (HU-084) y registro de pruebas de carga (HU-085).
package operacion

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

// LimiteMs es el tiempo de respuesta máximo aceptado por el backlog: 2 segundos.
const LimiteMs = 2000

// Frecuencias válidas de una programación de respaldo.
const (
	FrecuenciaDiaria      = "DIARIA"
	FrecuenciaCada12Horas = "CADA_12_HORAS"
	FrecuenciaSemanal     = "SEMANAL"
)

// Estados de un respaldo.
const (
	RespaldoEnCurso    = "EN_CURSO"
	RespaldoCompletado = "COMPLETADO"
	RespaldoFallido    = "FALLIDO"
	RespaldoExpirado   = "EXPIRADO"
)

// Programacion es la copia de seguridad periódica configurada (HU-081). Solo hay una
// activa a la vez: el servicio la crea con valores por defecto y la actualiza.
type Programacion struct {
	ID                string    `json:"id"`
	Frecuencia        string    `json:"frecuencia"`
	Hora              string    `json:"hora"` // HH:MM en UTC
	RetencionDias     int       `json:"retencionDias"`
	IncluyeDocumentos bool      `json:"incluyeDocumentos"`
	IncluyeBitacora   bool      `json:"incluyeBitacora"`
	Activa            bool      `json:"activa"`
	ActualizadoPor    string    `json:"actualizadoPor,omitempty"`
	ActualizadoEn     time.Time `json:"actualizadoEn"`
}

// Respaldo es una copia ejecutada, manual o programada (HU-081).
type Respaldo struct {
	ID             string     `json:"id"`
	ProgramacionID *string    `json:"programacionId"`
	Estado         string     `json:"estado"`
	BasesIncluidas []string   `json:"basesIncluidas"`
	Ubicacion      *string    `json:"ubicacion"`
	TamanoBytes    *int64     `json:"tamanoBytes"`
	ChecksumSHA256 *string    `json:"checksumSha256"`
	IniciadoPor    *string    `json:"iniciadoPor"`
	IniciadoEn     time.Time  `json:"iniciadoEn"`
	FinalizadoEn   *time.Time `json:"finalizadoEn"`
	ExpiraEn       *time.Time `json:"expiraEn"`
	MensajeError   *string    `json:"mensajeError"`
}

// Medicion es una ventana de tiempos de respuesta frente al límite de 2 s (HU-084).
type Medicion struct {
	ID           string    `json:"id,omitempty"`
	Servicio     string    `json:"servicio"`
	Metodo       string    `json:"metodo"`
	Ruta         string    `json:"ruta"`
	VentanaDesde time.Time `json:"ventanaDesde"`
	VentanaHasta time.Time `json:"ventanaHasta"`
	Solicitudes  int       `json:"solicitudes"`
	P50Ms        int       `json:"p50Ms"`
	P95Ms        int       `json:"p95Ms"`
	P99Ms        int       `json:"p99Ms"`
	LimiteMs     int       `json:"limiteMs"`
	Cumple       bool      `json:"cumple"`
}

// nuevoUUID devuelve el uuid en los 16 bytes de una columna binary(16) y en texto.
func nuevoUUID() ([]byte, string) {
	crudo := make([]byte, 16)
	if _, err := rand.Read(crudo); err != nil {
		panic("no se pudo generar un identificador: " + err.Error())
	}
	// Bit 4 en la versión y bits 10xx en la variante, como un uuid v4.
	crudo[6] = (crudo[6] & 0x0f) | 0x40
	crudo[8] = (crudo[8] & 0x3f) | 0x80
	texto := hex.EncodeToString(crudo)
	return crudo, texto[0:8] + "-" + texto[8:12] + "-" + texto[12:16] + "-" + texto[16:20] + "-" + texto[20:]
}

// aBinario convierte un uuid textual a sus 16 bytes; devuelve nil si no lo es.
func aBinario(texto string) []byte {
	limpio := ""
	for _, c := range texto {
		if c != '-' {
			limpio += string(c)
		}
	}
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
