-- ms-document-management · radicación (HU-017…HU-024, HU-039, HU-040).
-- Las referencias a otras bases (tipo documental, área, entidad, usuario) son lógicas,
-- sin llave foránea. carpeta_id queda sin llave hasta que exista la tabla carpeta.

-- HU-017: consecutivo diario por origen para el código AAAAMMDD + X + CONSECUTIVO.
create table consecutivo_radicado (
    fecha          date       not null,
    origen_digito  char(1)    not null,
    ultimo         int        not null default 0,
    primary key (fecha, origen_digito)
) engine = InnoDB default charset = utf8mb4;

create table radicado (
    id                  binary(16)    not null,
    codigo              varchar(20)   not null,
    origen              varchar(16)   not null,
    clase               varchar(8)    not null default 'ORIGINAL',
    tipo_documental_id  binary(16)    not null,
    area_id             binary(16)    not null,
    asunto              varchar(300)  not null,
    remitente           varchar(160)  not null,
    destinatario        varchar(160)  not null,
    fecha_documento     date          not null,
    folios              int           not null default 1,
    entidad_id          binary(16)    null,
    carpeta_id          binary(16)    null,
    comentarios         varchar(2000) null,
    estado              varchar(16)   not null default 'RADICADO',
    radicado_por        binary(16)    not null,
    radicado_en         datetime(6)   not null,
    actualizado_por     binary(16)    null,
    actualizado_en      datetime(6)   null,
    version             int           not null default 0,
    primary key (id),
    constraint uk_radicado_codigo unique (codigo),
    constraint ck_radicado_origen check (origen in ('INTERNO', 'EXTERNO', 'RECIBIDO')),
    constraint ck_radicado_clase check (clase in ('ORIGINAL', 'COPIA')),
    constraint ck_radicado_estado check (estado in ('RADICADO', 'EN_TRAMITE', 'FINALIZADO', 'ANULADO')),
    constraint ck_radicado_folios check (folios > 0)
) engine = InnoDB default charset = utf8mb4;

create index ix_radicado_radicado_en on radicado (radicado_en);
create index ix_radicado_area_fecha on radicado (area_id, radicado_en);
create index ix_radicado_tipo on radicado (tipo_documental_id);
create index ix_radicado_origen_fecha on radicado (origen, radicado_en);

-- Outbox de eventos hacia ms-audit-infra (mismo patrón que servicio-usuarios).
create table evento_saliente (
    id                  binary(16)    not null,
    tipo                varchar(60)   not null,
    entidad             varchar(60)   not null,
    entidad_id          varchar(64)   null,
    actor_id            binary(16)    null,
    actor_correo        varchar(160)  null,
    detalle             varchar(500)  null,
    ocurrido_en         datetime(6)   not null,
    estado_publicacion  varchar(16)   not null default 'PENDIENTE',
    primary key (id),
    constraint ck_evento_saliente_estado check (estado_publicacion in ('PENDIENTE', 'PUBLICADO'))
) engine = InnoDB default charset = utf8mb4;

create index ix_evento_saliente_pendientes on evento_saliente (estado_publicacion, ocurrido_en);
