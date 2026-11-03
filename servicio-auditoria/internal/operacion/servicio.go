package operacion

import (
	"context"
	"time"
)

// Servicio reúne la medición de tiempos de respuesta (HU-084).
type Servicio struct {
	repositorio *Repositorio
	colector    *Colector
}

// NuevoServicio construye el servicio con una ventana de medición de una hora.
func NuevoServicio(repositorio *Repositorio) *Servicio {
	return &Servicio{repositorio: repositorio, colector: NuevoColector(time.Hour)}
}

// AplicarMigracion deja las tablas de operación en su sitio.
func (s *Servicio) AplicarMigracion(ctx context.Context) error {
	return s.repositorio.AplicarMigracion(ctx)
}
