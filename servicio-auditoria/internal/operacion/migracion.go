package operacion

import (
	"context"
	"fmt"
)

// Migraciones de los requerimientos no funcionales. Se aplican al arrancar y son
// idempotentes, igual que la de la bitácora. Los índices van dentro del create table
// porque MySQL no admite `create index if not exists`.
var migraciones = []string{
	`create table if not exists programacion_respaldo (
    id                  binary(16)  not null,
    frecuencia          varchar(16) not null,
    hora                time        not null,
    retencion_dias      int         not null,
    incluye_documentos  boolean     not null default true,
    incluye_bitacora    boolean     not null default true,
    activa              boolean     not null default true,
    actualizado_por     binary(16)  not null,
    actualizado_en      datetime(6) not null,
    primary key (id),
    constraint ck_programacion_frecuencia check (frecuencia in ('DIARIA', 'CADA_12_HORAS', 'SEMANAL')),
    constraint ck_programacion_retencion check (retencion_dias > 0)
) engine = InnoDB default charset = utf8mb4`,

	`create table if not exists respaldo (
    id                binary(16)    not null,
    programacion_id   binary(16)    null,
    estado            varchar(12)   not null default 'EN_CURSO',
    bases_incluidas   json          not null,
    ubicacion         varchar(300)  null,
    tamano_bytes      bigint        null,
    checksum_sha256   char(64)      null,
    iniciado_por      binary(16)    null,
    iniciado_en       datetime(6)   not null,
    finalizado_en     datetime(6)   null,
    expira_en         datetime(6)   null,
    mensaje_error     varchar(1000) null,
    primary key (id),
    constraint fk_respaldo_programacion foreign key (programacion_id) references programacion_respaldo (id),
    constraint ck_respaldo_estado check (estado in ('EN_CURSO', 'COMPLETADO', 'FALLIDO', 'EXPIRADO')),
    index ix_respaldo_fecha (iniciado_en)
) engine = InnoDB default charset = utf8mb4`,

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
