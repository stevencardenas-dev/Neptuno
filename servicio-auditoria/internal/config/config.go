// Package config lee la configuración del servicio desde variables de entorno.
//
// Los secretos no tienen valor por defecto: sin ellos el servicio no arranca, igual
// que servicio-usuarios y servicio-documentos. Los nombres de las variables son los
// mismos que usan los otros dos servicios para que el .env siga siendo uno solo.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

// Config es la configuración completa del servicio.
type Config struct {
	Puerto  int
	JWT     JWT
	DB      DB
	Eventos Eventos
}

// JWT es el secreto compartido con servicio-usuarios, que es quien emite los tokens.
type JWT struct {
	Secreto string
	Emisor  string
}

// DB apunta a la base propia del servicio (audit_infra_db), nunca a la de otro.
type DB struct {
	Host    string
	Puerto  int
	Nombre  string
	Usuario string
	Clave   string
}

// Eventos describe el exchange directo por el que llegan los eventos de bitácora.
type Eventos struct {
	URL        string
	Exchange   string
	Cola       string
	RoutingKey string
}

// Cargar valida y devuelve la configuración; devuelve error si falta un secreto.
func Cargar() (Config, error) {
	secreto := os.Getenv("JWT_SECRETO")
	if secreto == "" {
		return Config{}, errors.New("falta la variable de entorno JWT_SECRETO")
	}
	if len(secreto) < 32 {
		return Config{}, errors.New("JWT_SECRETO debe tener al menos 32 caracteres")
	}
	claveDB := os.Getenv("DB_CLAVE")
	if claveDB == "" {
		return Config{}, errors.New("falta la variable de entorno DB_CLAVE")
	}
	claveRabbit := os.Getenv("RABBIT_CLAVE")
	if claveRabbit == "" {
		return Config{}, errors.New("falta la variable de entorno RABBIT_CLAVE")
	}

	usuarioRabbit := texto("RABBIT_USUARIO", "neptuno")
	hostRabbit := texto("RABBIT_HOST", "localhost")
	puertoRabbit := entero("RABBIT_PORT", 5672)

	return Config{
		Puerto: entero("SERVER_PORT", 8083),
		JWT: JWT{
			Secreto: secreto,
			Emisor:  texto("JWT_EMISOR", "neptuno-ms-auth-catalogs"),
		},
		DB: DB{
			Host:    texto("DB_HOST", "localhost"),
			Puerto:  entero("DB_PORT", 3306),
			Nombre:  texto("DB_NOMBRE", "audit_infra_db"),
			Usuario: texto("DB_USUARIO", "neptuno"),
			Clave:   claveDB,
		},
		Eventos: Eventos{
			URL: fmt.Sprintf("amqp://%s:%s@%s:%d",
				escapar(usuarioRabbit), escapar(claveRabbit), hostRabbit, puertoRabbit),
			Exchange:   texto("EVENTOS_EXCHANGE", "neptuno.eventos"),
			Cola:       texto("EVENTOS_COLA_AUDITORIA", "audit.infrastructure"),
			RoutingKey: texto("EVENTOS_ROUTING_KEY", "audit.evento"),
		},
	}, nil
}

// DSN arma la cadena de conexión de MySQL. `parseTime` y `loc=UTC` son necesarios para
// que las fechas vuelvan como time.Time y para que la cadena de hashes no dependa de la
// zona horaria del contenedor; `multiStatements` permite aplicar la migración completa.
func (d DB) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true&loc=UTC&charset=utf8mb4&multiStatements=true&timeout=10s",
		d.Usuario, d.Clave, d.Host, d.Puerto, d.Nombre)
}

// escapar codifica las credenciales del broker para que quepan en la URL de amqp.
// QueryEscape usa '+' para el espacio, que en la parte de usuario de una URL es un
// carácter literal: por eso se reemplaza por %20.
func escapar(valor string) string {
	return strings.ReplaceAll(url.QueryEscape(valor), "+", "%20")
}

func texto(nombre, porDefecto string) string {
	if valor := os.Getenv(nombre); valor != "" {
		return valor
	}
	return porDefecto
}

func entero(nombre string, porDefecto int) int {
	valor, err := strconv.Atoi(os.Getenv(nombre))
	if err != nil || valor <= 0 {
		return porDefecto
	}
	return valor
}
