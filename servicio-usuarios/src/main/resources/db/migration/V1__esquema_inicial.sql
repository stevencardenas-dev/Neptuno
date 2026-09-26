-- Neptuno · servicio-usuarios (ms-auth-catalogs)
-- Esquema inicial de auth_catalogs_db: identidad, accesos (RBAC) y catálogos maestros.
-- HU-001…HU-016, HU-022.

create table area (
    id              binary(16)   not null,
    codigo          varchar(20)  not null,
    nombre          varchar(120) not null,
    responsable     varchar(120) null,
    estado          varchar(16)  not null,
    creado_en       datetime(6)  not null,
    actualizado_en  datetime(6)  null,
    primary key (id),
    constraint uk_area_codigo unique (codigo),
    constraint uk_area_nombre unique (nombre)
) engine = InnoDB default charset = utf8mb4;

create table permiso (
    id           binary(16)   not null,
    codigo       varchar(60)  not null,
    nombre       varchar(120) not null,
    modulo       varchar(80)  not null,
    descripcion  varchar(240) null,
    primary key (id),
    constraint uk_permiso_codigo unique (codigo)
) engine = InnoDB default charset = utf8mb4;

create table rol (
    id              binary(16)   not null,
    nombre          varchar(80)  not null,
    descripcion     varchar(300) null,
    tipo            varchar(20)  not null,
    creado_en       datetime(6)  not null,
    actualizado_en  datetime(6)  null,
    primary key (id),
    constraint uk_rol_nombre unique (nombre)
) engine = InnoDB default charset = utf8mb4;

create table rol_permiso (
    rol_id      binary(16) not null,
    permiso_id  binary(16) not null,
    primary key (rol_id, permiso_id),
    constraint fk_rol_permiso_rol foreign key (rol_id) references rol (id),
    constraint fk_rol_permiso_permiso foreign key (permiso_id) references permiso (id)
) engine = InnoDB default charset = utf8mb4;

create table usuario (
    id                binary(16)   not null,
    nombre            varchar(120) not null,
    correo            varchar(160) not null,
    clave_hash        varchar(100) not null,
    area_id           binary(16)   not null,
    estado            varchar(16)  not null,
    ultimo_acceso     datetime(6)  null,
    intentos_fallidos int          not null default 0,
    bloqueado_hasta   datetime(6)  null,
    creado_en         datetime(6)  not null,
    actualizado_en    datetime(6)  null,
    eliminado_en      datetime(6)  null,
    eliminado_por     binary(16)   null,
    primary key (id),
    constraint uk_usuario_correo unique (correo),
    constraint fk_usuario_area foreign key (area_id) references area (id)
) engine = InnoDB default charset = utf8mb4;

create table usuario_rol (
    usuario_id  binary(16) not null,
    rol_id      binary(16) not null,
    primary key (usuario_id, rol_id),
    constraint fk_usuario_rol_usuario foreign key (usuario_id) references usuario (id),
    constraint fk_usuario_rol_rol foreign key (rol_id) references rol (id)
) engine = InnoDB default charset = utf8mb4;

create table tipo_documental (
    id              binary(16)   not null,
    nombre          varchar(120) not null,
    prefijo         varchar(10)  null,
    estado          varchar(16)  not null,
    creado_en       datetime(6)  not null,
    actualizado_en  datetime(6)  null,
    primary key (id),
    constraint uk_tipo_documental_nombre unique (nombre)
) engine = InnoDB default charset = utf8mb4;

create table tipo_documental_origen (
    tipo_documental_id  binary(16)  not null,
    origen              varchar(20) not null,
    constraint fk_tipo_documental_origen foreign key (tipo_documental_id) references tipo_documental (id)
) engine = InnoDB default charset = utf8mb4;

create table entidad (
    id              binary(16)   not null,
    nit             varchar(30)  not null,
    razon_social    varchar(160) not null,
    ciudad          varchar(80)  null,
    tipo            varchar(40)  null,
    estado          varchar(16)  not null,
    creado_en       datetime(6)  not null,
    actualizado_en  datetime(6)  null,
    primary key (id),
    constraint uk_entidad_nit unique (nit)
) engine = InnoDB default charset = utf8mb4;

-- HU-002: tokens invalidados al cerrar sesión.
create table token_revocado (
    jti          varchar(64) not null,
    usuario_id   binary(16)  null,
    expira_en    datetime(6) not null,
    revocado_en  datetime(6) not null,
    motivo       varchar(60) null,
    primary key (jti)
) engine = InnoDB default charset = utf8mb4;

-- Bitácora local de eventos publicados a ms-audit-infra (RabbitMQ).
create table evento_auditoria (
    id                  binary(16)    not null,
    tipo                varchar(60)   not null,
    entidad             varchar(60)   not null,
    entidad_id          varchar(64)   null,
    actor_id            binary(16)    null,
    actor_correo        varchar(160)  null,
    detalle             varchar(1000) null,
    ocurrido_en         datetime(6)   not null,
    estado_publicacion  varchar(16)   not null,
    primary key (id)
) engine = InnoDB default charset = utf8mb4;

create index ix_usuario_estado on usuario (estado);
create index ix_usuario_area on usuario (area_id);
create index ix_evento_auditoria_estado on evento_auditoria (estado_publicacion);
