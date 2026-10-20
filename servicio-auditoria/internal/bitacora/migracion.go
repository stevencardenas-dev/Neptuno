package bitacora

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
)

// migracionTabla crea la bitácora. Corresponde a docs/esquema-base-datos.sql y se aplica
// al arrancar, igual que servicio-documentos: así el contenedor se puede recrear sin
// pasos manuales ni perder nada.
//
// Los índices van dentro del create table a propósito: MySQL no acepta
// `create index if not exists` y definirlos aquí mantiene la migración idempotente, con
// los mismos nombres de índice que el esquema.
const migracionTabla = `
create table if not exists registro_bitacora (
    secuencia        bigint        not null auto_increment,
    evento_id        binary(16)    not null comment 'id del evento en el outbox de origen: consumo idempotente',
    servicio_origen  varchar(40)   not null,
    tipo_evento      varchar(60)   not null comment 'p. ej. radicado.creado, tramite.estado-cambiado, documento.firmado',
    entidad          varchar(60)   not null,
    entidad_id       varchar(64)   null,
    radicado_id      binary(16)    null comment 'HU-046: historial por documento',
    actor_id         binary(16)    null,
    actor_correo     varchar(160)  null,
    estado_anterior  varchar(80)   null comment 'HU-045',
    estado_nuevo     varchar(80)   null comment 'HU-045',
    observacion      varchar(2000) null comment 'HU-045',
    detalle          json          null,
    ocurrido_en      datetime(6)   not null,
    recibido_en      datetime(6)   not null,
    hash_anterior    char(64)      null,
    hash             char(64)      not null,
    primary key (secuencia),
    constraint uk_bitacora_evento unique (evento_id),
    constraint uk_bitacora_hash unique (hash),
    index ix_bitacora_radicado (radicado_id, ocurrido_en),
    index ix_bitacora_actor (actor_id, ocurrido_en),
    index ix_bitacora_tipo (tipo_evento, ocurrido_en),
    index ix_bitacora_fecha (ocurrido_en)
) engine = InnoDB default charset = utf8mb4`

// disparador describe un disparador de la bitácora; MySQL no admite `create trigger if
// not exists`, así que se comprueba antes si ya existe.
type disparador struct {
	nombre   string
	creacion string
}

// HU-044: la base misma rechaza modificar o borrar la bitácora. Es un refuerzo del hash
// encadenado, no su sustituto: el disparador impide la escritura y la cadena, además,
// la detecta.
var disparadores = []disparador{
	{
		nombre: "tr_bitacora_sin_update",
		creacion: `create trigger tr_bitacora_sin_update before update on registro_bitacora
for each row signal sqlstate '45000' set message_text = 'La bitácora es inalterable: no se permite modificar registros (HU-044).'`,
	},
	{
		nombre: "tr_bitacora_sin_delete",
		creacion: `create trigger tr_bitacora_sin_delete before delete on registro_bitacora
for each row signal sqlstate '45000' set message_text = 'La bitácora es inalterable: no se permite eliminar registros (HU-044).'`,
	},
}

// AplicarMigracion deja la base lista para usarse; se puede ejecutar en cada arranque.
func (r *Repositorio) AplicarMigracion(ctx context.Context) error {
	if _, err := r.base.ExecContext(ctx, migracionTabla); err != nil {
		return fmt.Errorf("no se pudo crear registro_bitacora: %w", err)
	}
	for _, d := range disparadores {
		existe, err := r.existeDisparador(ctx, d.nombre)
		if err != nil {
			return err
		}
		if existe {
			continue
		}
		if _, err := r.base.ExecContext(ctx, d.creacion); err != nil {
			// La inmutabilidad la garantiza la cadena de hashes; el disparador es un refuerzo.
			// Si el usuario de la base no puede crear disparadores, se avisa y se sigue: la
			// bitácora no deja de ser verificable por eso.
			slog.Warn("no se pudo crear el disparador que protege la bitácora; la cadena de hashes sigue verificando la integridad",
				"disparador", d.nombre, "error", err)
		}
	}
	return nil
}

func (r *Repositorio) existeDisparador(ctx context.Context, nombre string) (bool, error) {
	const consulta = `select count(*) from information_schema.triggers
	                   where trigger_schema = database() and trigger_name = ?`
	var total int
	if err := r.base.QueryRowContext(ctx, consulta, nombre).Scan(&total); err != nil {
		return false, fmt.Errorf("no se pudo comprobar el disparador %s: %w", nombre, err)
	}
	return total > 0, nil
}

// comprobarTabla se llama al arrancar para fallar temprano y claro si la migración no
// dejó la tabla en su sitio.
func (r *Repositorio) comprobarTabla(ctx context.Context) error {
	var existe sql.NullString
	err := r.base.QueryRowContext(ctx,
		`select table_name from information_schema.tables
		  where table_schema = database() and table_name = 'registro_bitacora'`).Scan(&existe)
	if err != nil {
		return fmt.Errorf("no se pudo comprobar la tabla de bitácora: %w", err)
	}
	if !existe.Valid {
		return fmt.Errorf("la tabla registro_bitacora no existe en la base configurada")
	}
	return nil
}
