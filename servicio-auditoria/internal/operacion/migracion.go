package operacion

import (
	"context"
	"fmt"
)

// Migraciones de los requerimientos no funcionales. Se aplican al arrancar y son
// idempotentes, igual que la de la bitácora. Los índices van dentro del create table
// porque MySQL no admite `create index if not exists`.
var migraciones = []string{
	`create table if not exists medicion_rendimiento (
    id             binary(16)   not null,
    servicio       varchar(40)  not null,
    metodo         varchar(8)   not null,
    ruta           varchar(200) not null,
    ventana_desde  datetime(6)  not null,
    ventana_hasta  datetime(6)  not null,
    solicitudes    int          not null,
    p50_ms         int          not null,
    p95_ms         int          not null,
    p99_ms         int          not null,
    limite_ms      int          not null default 2000,
    cumple         boolean      generated always as (p95_ms <= limite_ms) stored,
    primary key (id),
    constraint ck_medicion_ventana check (ventana_hasta > ventana_desde),
    index ix_medicion_servicio (servicio, ventana_desde)
) engine = InnoDB default charset = utf8mb4`,
}

// AplicarMigracion deja las tablas de operación en su sitio.
func (r *Repositorio) AplicarMigracion(ctx context.Context) error {
	for _, sentencia := range migraciones {
		if _, err := r.base.ExecContext(ctx, sentencia); err != nil {
			return fmt.Errorf("no se pudo aplicar una migración de operación: %w", err)
		}
	}
	return nil
}
