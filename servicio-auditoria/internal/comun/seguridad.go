package comun

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// Actor es el usuario autenticado, tomado del token de acceso.
type Actor struct {
	ID       string
	Correo   string
	AreaID   string
	Roles    []string
	Permisos map[string]bool
}

// Tiene indica si el actor tiene el permiso pedido (HU-013).
func (a Actor) Tiene(codigo string) bool { return a.Permisos[codigo] }

// reclamos son los campos que emite servicio-usuarios en el token de acceso.
type reclamos struct {
	jwt.RegisteredClaims
	Tipo     string   `json:"typ"`
	Correo   string   `json:"correo"`
	AreaID   string   `json:"areaId"`
	Roles    []string `json:"roles"`
	Permisos []string `json:"permisos"`
}

type claveContexto struct{}

var claveActor = claveContexto{}

// Autenticar valida el JWT de acceso (HS256, el mismo secreto que servicio-usuarios y
// servicio-documentos) y deja al actor en el contexto de la solicitud. Los permisos
// viajan dentro del token, así que no hay llamada de red en cada petición.
//
// Limitación conocida, igual que en servicio-documentos: no consulta la lista de tokens
// revocados, así que un token cerrado con logout vale aquí hasta que expire.
func Autenticar(secreto, emisor string) func(http.Handler) http.Handler {
	llave := []byte(secreto)
	return func(siguiente http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cabecera := r.Header.Get("Authorization")
			if !strings.HasPrefix(cabecera, "Bearer ") {
				EscribirError(w, NoAutenticado("Falta el token de acceso."))
				return
			}
			leidos := &reclamos{}
			_, err := jwt.ParseWithClaims(strings.TrimPrefix(cabecera, "Bearer "), leidos,
				func(*jwt.Token) (any, error) { return llave, nil },
				jwt.WithValidMethods([]string{"HS256"}),
				jwt.WithIssuer(emisor),
			)
			if err != nil || leidos.Tipo != "ACCESO" {
				EscribirError(w, NoAutenticado("El token de acceso no es válido o ya expiró."))
				return
			}
			permisos := make(map[string]bool, len(leidos.Permisos))
			for _, permiso := range leidos.Permisos {
				permisos[permiso] = true
			}
			actor := Actor{
				ID:       leidos.Subject,
				Correo:   leidos.Correo,
				AreaID:   leidos.AreaID,
				Roles:    leidos.Roles,
				Permisos: permisos,
			}
			siguiente.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claveActor, actor)))
		})
	}
}

// ActorDe devuelve el actor que dejó Autenticar en el contexto de la solicitud.
func ActorDe(r *http.Request) (Actor, bool) {
	actor, ok := r.Context().Value(claveActor).(Actor)
	return actor, ok
}

// RequierePermiso envuelve un manejador y exige un permiso concreto del catálogo.
func RequierePermiso(codigo string, manejador http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor, ok := ActorDe(r)
		if !ok || !actor.Tiene(codigo) {
			EscribirError(w, Prohibido("Requiere el permiso "+codigo+"."))
			return
		}
		manejador(w, r)
	}
}
