-- ms-workflow-bpm · firmas electrónicas (HU-075…HU-077).
-- V1…V3 ya corrieron: aquí solo se añade lo que falta. Cada sentencia se puede repetir
-- (el migrador salta lo que ya existe), así que una migración cortada se reanuda.

-- HU-075, HU-077: firmas electrónicas aplicadas en los pasos que las exigen.
create table if not exists firma (
    id               binary(16)   not null,
    tramite_id       binary(16)   not null,
    tarea_id         binary(16)   not null,
    estado_flujo_id  binary(16)   not null,
    firmante_id      binary(16)   not null comment 'Ref. lógica: usuario (auth_catalogs_db)',
    firmante_nombre  varchar(120) not null comment 'Copia al firmar: el nombre no cambia si se edita el usuario',
    hash_documento   char(64)     not null comment 'SHA-256 del documento firmado',
    metodo           varchar(16)  not null default 'ELECTRONICA',
    ip_origen        varchar(45)  null,
    firmado_en       datetime(6)  not null,
    primary key (id),
    constraint uk_firma_tarea_firmante unique (tarea_id, firmante_id),
    constraint fk_firma_tramite foreign key (tramite_id) references tramite (id),
    constraint fk_firma_tarea foreign key (tarea_id) references tarea (id),
    constraint fk_firma_estado foreign key (estado_flujo_id) references estado_flujo (id),
    constraint ck_firma_metodo check (metodo in ('ELECTRONICA', 'DIGITAL'))
) engine = InnoDB default charset = utf8mb4;

create index ix_firma_tramite on firma (tramite_id, firmado_en);
