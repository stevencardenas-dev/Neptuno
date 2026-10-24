-- Vínculo entre los flujos y los tipos documentales (ms-auth-catalogs): quien radica un
-- documento elige entre los flujos que atienden el tipo documental de ese documento.
-- No se declara clave foránea al tipo porque vive en otra base de datos.
create table flujo_tipo_documental (
    flujo_id            binary(16)  not null,
    tipo_documental_id  binary(16)  not null,
    asociado_por        binary(16)  null,
    asociado_en         datetime(6) not null,
    primary key (flujo_id, tipo_documental_id),
    key ix_flujo_tipo_documental_tipo (tipo_documental_id),
    constraint fk_flujo_tipo_documental_flujo foreign key (flujo_id) references flujo (id) on delete cascade
) engine = InnoDB default charset = utf8mb4;

-- Un trámite es un radicado recorriendo una versión publicada del flujo. Guarda la versión
-- con la que nació (HU-078, HU-080): publicar otra después no lo cambia de camino.
create table tramite (
    id                binary(16)   not null,
    radicado_id       binary(16)   not null comment 'Radicado de ms-document-management',
    radicado_codigo   varchar(40)  not null,
    flujo_id          binary(16)   not null,
    version_id        binary(16)   not null,
    estado_actual_id  binary(16)   not null comment 'Paso en el que está hoy',
    estado            varchar(12)  not null default 'EN_CURSO',
    iniciado_por      binary(16)   not null,
    iniciado_en       datetime(6)  not null,
    primary key (id),
    -- Un radicado tiene como mucho un trámite; también vuelve idempotente el reintento.
    constraint uk_tramite_radicado unique (radicado_id),
    key ix_tramite_estado_actual (estado_actual_id, estado),
    constraint fk_tramite_flujo foreign key (flujo_id) references flujo (id),
    constraint fk_tramite_version foreign key (version_id) references flujo_version (id),
    constraint fk_tramite_estado_actual foreign key (estado_actual_id) references estado_flujo (id),
    constraint ck_tramite_estado check (estado in ('EN_CURSO', 'FINALIZADO', 'CANCELADO'))
) engine = InnoDB default charset = utf8mb4;
