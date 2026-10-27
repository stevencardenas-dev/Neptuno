-- ms-document-management · anexos en MinIO (HU-025…HU-029, HU-038).
-- El archivo vive en MinIO y la base guarda sus metadatos y la clave del objeto.
-- La eliminación es lógica (HU-029): el registro queda con su constancia y el
-- objeto se conserva en MinIO para no romper el historial.
-- Repetible: si la tabla ya existe (por un despliegue anterior) no hace nada.

create table if not exists anexo (
    id                       binary(16)    not null,
    radicado_id              binary(16)    null,
    documento_expediente_id  binary(16)    null,
    nombre_original          varchar(255)  not null,
    extension                varchar(8)    not null comment 'HU-026',
    tipo_mime                varchar(120)  not null,
    tamano_bytes             bigint        not null,
    objeto_clave             varchar(300)  not null comment 'Clave del objeto en MinIO',
    hash_sha256              char(64)      not null,
    procedencia              varchar(12)   not null default 'CARGA' comment 'CARGA o PLANTILLA (HU-038)',
    cargado_por              binary(16)    not null,
    cargado_en               datetime(6)   not null,
    eliminado_en             datetime(6)   null,
    eliminado_por            binary(16)    null,
    motivo_eliminacion       varchar(500)  null,
    primary key (id),
    key ix_anexo_radicado (radicado_id, eliminado_en),
    constraint uk_anexo_objeto unique (objeto_clave),
    constraint fk_anexo_radicado foreign key (radicado_id) references radicado (id),
    constraint ck_anexo_duenio check ((radicado_id is null) <> (documento_expediente_id is null)),
    constraint ck_anexo_extension check (extension in ('pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx')),
    constraint ck_anexo_tamano check (tamano_bytes > 0),
    constraint ck_anexo_procedencia check (procedencia in ('CARGA', 'PLANTILLA')),
    constraint ck_anexo_eliminacion check (eliminado_en is null or motivo_eliminacion is not null)
) engine = InnoDB default charset = utf8mb4;
