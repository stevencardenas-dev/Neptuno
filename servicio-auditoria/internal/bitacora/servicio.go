package bitacora

import (
	"context"
	"strings"
	"time"

	"neptuno/auditoria/internal/comun"
)

// Servicio es la lógica de la bitácora: encadenar lo que llega y verificar lo guardado.
type Servicio struct {
	repositorio *Repositorio
}

// NuevoServicio construye el servicio sobre su repositorio.
func NuevoServicio(repositorio *Repositorio) *Servicio {
	return &Servicio{repositorio: repositorio}
}

// AplicarMigracion deja la base lista para usarse.
func (s *Servicio) AplicarMigracion(ctx context.Context) error {
	return s.repositorio.AplicarMigracion(ctx)
}

// Comprobar comprueba que la base responde y que la bitácora existe.
func (s *Servicio) Comprobar(ctx context.Context) error {
	return s.repositorio.Comprobar(ctx)
}

// Registrar encadena un evento (HU-043). Devuelve si se insertó: un mensaje reentregado
// no duplica la bitácora.
func (s *Servicio) Registrar(ctx context.Context, evento Evento) (Registro, bool, error) {
	if strings.TrimSpace(evento.ID) == "" {
		return Registro{}, false, comun.ReglaInvalida("El evento no trae identificador.")
	}
	if strings.TrimSpace(evento.Tipo) == "" || strings.TrimSpace(evento.Entidad) == "" {
		return Registro{}, false, comun.ReglaInvalida("El evento no dice qué ocurrió ni sobre qué entidad.")
	}
	registro, err := RegistroDesdeEvento(evento, time.Now().UTC())
	if err != nil {
		return Registro{}, false, comun.ReglaInvalida(err.Error())
	}
	return s.repositorio.Insertar(ctx, registro)
}

// Listar devuelve una página de bitácora filtrada.
func (s *Servicio) Listar(ctx context.Context, filtros Filtros) (Pagina, error) {
	if filtros.Tamanio <= 0 {
		filtros.Tamanio = 25
	}
	if filtros.Pagina < 0 {
		filtros.Pagina = 0
	}
	return s.repositorio.Listar(ctx, filtros)
}

// Obtener devuelve un registro por su secuencia.
func (s *Servicio) Obtener(ctx context.Context, secuencia int64) (Registro, error) {
	return s.repositorio.Obtener(ctx, secuencia)
}

// Historial devuelve el historial de un documento (HU-046).
func (s *Servicio) Historial(ctx context.Context, radicadoID string) ([]Registro, error) {
	return s.repositorio.PorRadicado(ctx, radicadoID)
}

// Facetas devuelve los valores que hoy existen en la bitácora, para los filtros (HU-047).
func (s *Servicio) Facetas(ctx context.Context) (Facetas, error) {
	return s.repositorio.Facetas(ctx)
}

// Verificacion es el resultado de recorrer la cadena (HU-044).
type Verificacion struct {
	Integra      bool      `json:"integra"`
	Registros    int       `json:"registros"`
	PrimerCorte  *Corte    `json:"primerCorte"`
	ComprobadoEn time.Time `json:"comprobadoEn"`
}

// Corte señala el primer registro donde la cadena deja de cuadrar.
type Corte struct {
	Secuencia int64  `json:"secuencia"`
	Motivo    string `json:"motivo"`
}

// Verificar recorre la bitácora entera recalculando cada hash y comprobando que cada
// registro apunte al anterior (HU-044).
//
// Detecta los tres casos que importan: una fila modificada (el hash recalculado ya no
// coincide), una fila borrada y una fila reubicada (el enlace con el anterior deja de
// cuadrar). Un atacante que además reescribiera todos los hashes posteriores no sería
// detectable solo con esto: para eso la cadena tendría que anclarse fuera del sistema.
func (s *Servicio) Verificar(ctx context.Context) (Verificacion, error) {
	var anterior *string
	revisados := 0
	var corte *Corte

	err := s.repositorio.Recorrer(ctx, func(registro Registro) error {
		revisados++
		switch {
		case !enlazado(registro.HashAnterior, anterior):
			corte = &Corte{Secuencia: registro.Secuencia, Motivo: "El registro no apunta al hash del anterior."}
		case registro.Hash != Hash(registro):
			corte = &Corte{Secuencia: registro.Secuencia, Motivo: "El hash no corresponde al contenido del registro."}
		}
		// El enlace se sigue comparando contra el hash guardado, no contra el recalculado,
		// así que una sola fila alterada produce un único corte y no una cascada de avisos.
		anterior = &registro.Hash
		return nil
	})
	if err != nil {
		return Verificacion{}, err
	}
	return Verificacion{
		Integra:      corte == nil,
		Registros:    revisados,
		PrimerCorte:  corte,
		ComprobadoEn: time.Now().UTC(),
	}, nil
}

// enlazado indica si un registro apunta al hash del anterior. El primero de la cadena no
// tiene anterior, y por eso ahí se espera nil.
func enlazado(hashAnterior, esperado *string) bool {
	if hashAnterior == nil || esperado == nil {
		return hashAnterior == nil && esperado == nil
	}
	return *hashAnterior == *esperado
}
