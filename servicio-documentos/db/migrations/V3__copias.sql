-- ms-document-management · copias informativas (HU-041, HU-042).
-- Transcrito de docs/esquema-base-datos.sql, sección 1. La referencia al destinatario
-- (usuario de auth_catalogs_db) es lógica, sin llave foránea.

-- HU-041, HU-042: copias informativas y la bandeja secundaria de cada destinatario.
create table if not exists copia_informativa (
    id               binary(16)   not null,
    radicado_id      binary(16)   not null,
    destinatario_id  binary(16)   not null comment 'Ref. lógica: usuario (auth_catalogs_db)',
    mensaje          varchar(500) null,
    enviada_por      binary(16)   not null,
    enviada_en       datetime(6)  not null,
    leida_en         datetime(6)  null,
    primary key (id),
    constraint uk_copia_destinatario unique (radicado_id, destinatario_id),
    constraint fk_copia_radicado foreign key (radicado_id) references radicado (id),
    index ix_copia_bandeja (destinatario_id, leida_en, enviada_en)
) engine = InnoDB default charset = utf8mb4;
