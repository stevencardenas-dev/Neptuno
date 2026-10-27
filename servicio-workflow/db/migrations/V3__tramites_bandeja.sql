-- ms-workflow-bpm · bandeja de entrada sobre los trámites de V2 (HU-062…HU-074, HU-078).
-- V2 ya corrió en producción y no se edita: aquí se amplía la tabla tramite y se crean
-- tarea y movimiento_tramite (docs/esquema-base-datos.sql, sección 2).
-- El código y el asunto del radicado y el nombre del flujo se copian al iniciar para que
-- la bandeja no dependa de una llamada a ms-document-management en cada consulta.
-- Corre igual sobre una base vacía (V1, V2, V3) que sobre una con trámites de V2: al
-- final rellena lo que esos trámites no tenían.

-- Una sentencia por cambio: MySQL confirma el DDL solo y no hay transacción que lo deshaga,
-- así que si la migración se corta a medias el reintento salta lo ya aplicado (ver db.ts)
-- y cada cambio tiene que poder repetirse por separado.
alter table tramite add column radicado_asunto varchar(300) not null default '' comment 'Copia de lectura para la bandeja' after radicado_codigo;
alter table tramite add column flujo_nombre varchar(120) not null default '' comment 'Copia de lectura para la bandeja' after flujo_id;
alter table tramite add column vence_en datetime(6) null comment 'HU-072: iniciado_en + sla_global_minutos' after iniciado_en;
alter table tramite add column finalizado_en datetime(6) null after vence_en;
alter table tramite add column version int not null default 0 comment 'Bloqueo optimista (HU-071)' after finalizado_en;
alter table tramite add column radicado_en_curso_id binary(16) generated always as (case when estado = 'EN_CURSO' then radicado_id end) stored after version;

-- Un radicado tiene como mucho un trámite EN CURSO: si se cancela, se puede reenviar.
alter table tramite add constraint uk_tramite_radicado_en_curso unique (radicado_en_curso_id);
alter table tramite add index ix_tramite_radicado (radicado_id);
alter table tramite add index ix_tramite_flujo (flujo_id, estado);

alter table tramite drop index uk_tramite_radicado;

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
    constraint fk_movimiento_origen foreign key (estado_origen_id) references estado_flujo (id),
    constraint fk_movimiento_destino foreign key (estado_destino_id) references estado_flujo (id),
    constraint ck_movimiento_accion check (accion in ('INICIAR', 'APROBAR', 'DEVOLVER', 'CANCELAR', 'ENVIAR', 'TOMAR', 'LIBERAR')),
    constraint ck_movimiento_observacion check (accion not in ('CANCELAR', 'DEVOLVER') or observacion is not null)
) engine = InnoDB default charset = utf8mb4;

create index ix_movimiento_tramite on movimiento_tramite (tramite_id, ocurrido_en);

-- Relleno de los trámites que se iniciaron con V2. Cada sentencia solo toca lo que falta,
-- así que sobre una base vacía no hace nada y repetirla no duplica filas.

-- El nombre del flujo, que V2 no copiaba.
update tramite t
  join flujo f on f.id = t.flujo_id
   set t.flujo_nombre = f.nombre
 where t.flujo_nombre = '';

-- El vencimiento del trámite según el SLA global de la versión con la que nació.
update tramite t
  join flujo_version fv on fv.id = t.version_id
   set t.vence_en = date_add(t.iniciado_en, interval fv.sla_global_minutos minute)
 where t.vence_en is null and fv.sla_global_minutos is not null;

-- La tarea pendiente del paso en el que está cada trámite en curso. Su vencimiento es
-- el del paso, sin pasar el del trámite (igual que al iniciar).
insert into tarea (id, tramite_id, estado_flujo_id, estado, creada_en, vence_en)
select uuid_to_bin(uuid()), t.id, t.estado_actual_id, 'PENDIENTE', t.iniciado_en,
       case
         when e.sla_minutos is null or e.sla_minutos <= 0 then t.vence_en
         when t.vence_en is null then date_add(t.iniciado_en, interval e.sla_minutos minute)
         else least(date_add(t.iniciado_en, interval e.sla_minutos minute), t.vence_en)
       end
  from tramite t
  join estado_flujo e on e.id = t.estado_actual_id
 where t.estado = 'EN_CURSO'
   and not exists (select 1 from tarea ta where ta.tramite_id = t.id);

-- El movimiento de inicio, a nombre de quien inició el trámite, hacia el paso inicial
-- de su versión (o el paso actual si la versión no lo tuviera).
insert into movimiento_tramite (id, tramite_id, tarea_id, transicion_id, estado_origen_id, estado_destino_id,
                                accion, observacion, usuario_id, usuario_correo, ocurrido_en)
select uuid_to_bin(uuid()), t.id, null, null, null,
       coalesce((select ei.id from estado_flujo ei where ei.version_id = t.version_id and ei.tipo = 'INICIAL' limit 1),
                t.estado_actual_id),
       'INICIAR', null, t.iniciado_por, null, t.iniciado_en
  from tramite t
 where not exists (select 1 from movimiento_tramite m where m.tramite_id = t.id and m.accion = 'INICIAR');
