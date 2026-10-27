-- ms-workflow-bpm · trámites y bandeja de entrada (HU-062…HU-074, HU-078).
-- Transcrito del esquema de referencia (docs/esquema-base-datos.sql, sección 2), con dos
-- columnas de lectura añadidas al trámite: el código y el asunto del radicado se copian
-- al iniciar para que la bandeja no dependa de una llamada a ms-document-management en
-- cada consulta. El radicado sigue siendo el dueño del dato: si cambia, la copia se
-- refresca en la siguiente acción del trámite.

create table tramite (
    id                    binary(16)  not null,
    radicado_id           binary(16)  not null comment 'Ref. lógica: radicado (document_management_db)',
    radicado_codigo       varchar(20) not null comment 'Copia de lectura para la bandeja',
    radicado_asunto       varchar(300) not null comment 'Copia de lectura para la bandeja',
    flujo_id              binary(16)  not null comment 'Ref. lógica: flujo',
    flujo_nombre          varchar(120) not null comment 'Copia de lectura para la bandeja',
    flujo_version_id      binary(16)  not null comment 'HU-079: queda fija aunque se publique otra versión',
    estado_actual_id      binary(16)  not null,
    estado                varchar(12) not null default 'EN_CURSO',
    iniciado_por          binary(16)  not null,
    iniciado_en           datetime(6) not null,
    vence_en              datetime(6) null comment 'HU-072: iniciado_en + sla_global_minutos',
    finalizado_en         datetime(6) null,
    version               int         not null default 0 comment 'Bloqueo optimista (HU-071)',
    radicado_en_curso_id  binary(16)  generated always as (case when estado = 'EN_CURSO' then radicado_id end) stored,
    primary key (id),
    constraint uk_tramite_radicado_en_curso unique (radicado_en_curso_id),
    constraint fk_tramite_version foreign key (flujo_version_id) references flujo_version (id),
    constraint fk_tramite_estado_actual foreign key (estado_actual_id) references estado_flujo (id),
    constraint ck_tramite_estado check (estado in ('EN_CURSO', 'FINALIZADO', 'CANCELADO'))
) engine = InnoDB default charset = utf8mb4;

create index ix_tramite_radicado on tramite (radicado_id);
create index ix_tramite_flujo on tramite (flujo_id, estado);

-- HU-063…HU-070, HU-073, HU-074: tareas de la bandeja.
create table tarea (
    id               binary(16)    not null,
    tramite_id       binary(16)    not null,
    estado_flujo_id  binary(16)    not null,
    estado           varchar(12)   not null default 'PENDIENTE',
    asignada_a       binary(16)    null comment 'HU-070: usuario que tomó la tarea (claim)',
    tomada_en        datetime(6)   null,
    creada_en        datetime(6)   not null,
    vence_en         datetime(6)   null comment 'HU-073; el semáforo (HU-074) se calcula contra esta fecha',
    completada_en    datetime(6)   null,
    completada_por   binary(16)    null,
    version          int           not null default 0,
    primary key (id),
    constraint fk_tarea_tramite foreign key (tramite_id) references tramite (id),
    constraint fk_tarea_estado foreign key (estado_flujo_id) references estado_flujo (id),
    constraint ck_tarea_estado check (estado in ('PENDIENTE', 'TOMADA', 'COMPLETADA', 'CANCELADA')),
    constraint ck_tarea_tomada check (estado <> 'TOMADA' or asignada_a is not null)
) engine = InnoDB default charset = utf8mb4;

create index ix_tarea_bandeja on tarea (estado, vence_en);
create index ix_tarea_asignada on tarea (asignada_a, estado);
create index ix_tarea_tramite on tarea (tramite_id);

-- HU-066…HU-068 (y fuente de HU-045): cada movimiento del trámite con su observación.
create table movimiento_tramite (
    id                 binary(16)    not null,
    tramite_id         binary(16)    not null,
    tarea_id           binary(16)    null,
    transicion_id      binary(16)    null,
    estado_origen_id   binary(16)    null,
    estado_destino_id  binary(16)    not null,
    accion             varchar(16)   not null,
    observacion        varchar(2000) null,
    usuario_id         binary(16)    not null,
    usuario_correo     varchar(160)  null comment 'Copia al mover: se muestra en el recorrido del trámite',
    ocurrido_en        datetime(6)   not null,
    primary key (id),
    constraint fk_movimiento_tramite foreign key (tramite_id) references tramite (id),
    constraint fk_movimiento_tarea foreign key (tarea_id) references tarea (id),
    constraint fk_movimiento_transicion foreign key (transicion_id) references transicion (id),
    constraint ck_movimiento_accion check (accion in ('INICIAR', 'APROBAR', 'DEVOLVER', 'CANCELAR', 'ENVIAR', 'TOMAR', 'LIBERAR')),
    constraint ck_movimiento_observacion check (accion not in ('CANCELAR', 'DEVOLVER') or observacion is not null)
) engine = InnoDB default charset = utf8mb4;

create index ix_movimiento_tramite on movimiento_tramite (tramite_id, ocurrido_en);
