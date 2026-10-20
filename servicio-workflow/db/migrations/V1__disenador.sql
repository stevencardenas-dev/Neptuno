-- ms-workflow-bpm · diseñador de flujos (HU-048…HU-061).
-- Transcrito del esquema de referencia (docs/esquema-base-datos.sql, sección 2).
-- Las referencias a otras bases (usuario, rol, área) son lógicas: sin llave foránea.
-- Los comentarios conservan la HU de la que sale cada columna.

-- HU-048…HU-051: identidad del flujo. La definición (estados y transiciones) vive en
-- sus versiones para que los trámites en curso no cambien al editarlo (HU-078, HU-079).
create table flujo (
    id                 binary(16)   not null,
    nombre             varchar(120) not null,
    descripcion        varchar(500) null,
    estado             varchar(16)  not null default 'BORRADOR' comment 'HU-050: INACTIVO = desactivado',
    version_activa_id  binary(16)   null comment 'Versión publicada que usan los trámites nuevos',
    creado_por         binary(16)   not null,
    creado_en          datetime(6)  not null,
    actualizado_por    binary(16)   null,
    actualizado_en     datetime(6)  null,
    primary key (id),
    constraint uk_flujo_nombre unique (nombre),
    constraint ck_flujo_estado check (estado in ('BORRADOR', 'ACTIVO', 'INACTIVO'))
) engine = InnoDB default charset = utf8mb4;

-- HU-061, HU-072, HU-078, HU-080: versiones con fecha y autor.
create table flujo_version (
    id                   binary(16)   not null,
    flujo_id             binary(16)   not null,
    numero               int          not null,
    estado               varchar(16)   not null default 'BORRADOR',
    sla_global_minutos   int          null comment 'HU-072: duración máxima del trámite completo',
    notas                varchar(500) null,
    creado_por           binary(16)   not null,
    creado_en            datetime(6)  not null,
    publicado_por        binary(16)   null,
    publicado_en         datetime(6)  null,
    primary key (id),
    constraint uk_flujo_version_numero unique (flujo_id, numero),
    constraint fk_flujo_version_flujo foreign key (flujo_id) references flujo (id),
    constraint ck_flujo_version_estado check (estado in ('BORRADOR', 'PUBLICADA', 'REEMPLAZADA')),
    constraint ck_flujo_version_sla check (sla_global_minutos is null or sla_global_minutos > 0),
    constraint ck_flujo_version_publicacion check (estado = 'BORRADOR' or publicado_en is not null)
) engine = InnoDB default charset = utf8mb4;

alter table flujo
    add constraint fk_flujo_version_activa foreign key (version_activa_id) references flujo_version (id);

-- HU-053…HU-055, HU-069, HU-073, HU-076, HU-052 (posición en el lienzo).
create table estado_flujo (
    id                  binary(16)   not null,
    version_id          binary(16)   not null,
    nombre              varchar(80)  not null,
    descripcion         varchar(500) null,
    tipo                varchar(12)  not null default 'INTERMEDIO' comment 'HU-055',
    tipo_responsable    varchar(8)   null comment 'HU-069: USUARIO, GRUPO, ROL o AREA',
    sla_minutos         int          null comment 'HU-073: tiempo máximo del paso',
    requiere_firma      boolean      not null default false comment 'HU-076',
    posicion_x          int          not null default 0 comment 'HU-052',
    posicion_y          int          not null default 0 comment 'HU-052',
    -- Un solo estado inicial por versión.
    inicial_version_id  binary(16)   generated always as (case when tipo = 'INICIAL' then version_id end) stored,
    primary key (id),
    constraint uk_estado_flujo_nombre unique (version_id, nombre),
    constraint uk_estado_flujo_inicial unique (inicial_version_id),
    -- Sin "on delete cascade": MySQL lo prohíbe en la base de una columna generada.
    constraint fk_estado_flujo_version foreign key (version_id) references flujo_version (id),
    constraint ck_estado_flujo_tipo check (tipo in ('INICIAL', 'INTERMEDIO', 'FINAL')),
    constraint ck_estado_flujo_responsable check (tipo_responsable is null or tipo_responsable in ('USUARIO', 'GRUPO', 'ROL', 'AREA')),
    constraint ck_estado_flujo_sla check (sla_minutos is null or sla_minutos > 0)
) engine = InnoDB default charset = utf8mb4;

-- HU-069: grupos de trabajo (personas que atienden un paso en conjunto).
create table grupo_trabajo (
    id           binary(16)   not null,
    nombre       varchar(120) not null,
    descripcion  varchar(300) null,
    creado_por   binary(16)   not null,
    creado_en    datetime(6)  not null,
    primary key (id),
    constraint uk_grupo_trabajo_nombre unique (nombre)
) engine = InnoDB default charset = utf8mb4;

create table grupo_miembro (
    grupo_id    binary(16)  not null,
    usuario_id  binary(16)  not null comment 'Ref. lógica: usuario (auth_catalogs_db)',
    agregado_en datetime(6) not null,
    primary key (grupo_id, usuario_id),
    constraint fk_grupo_miembro_grupo foreign key (grupo_id) references grupo_trabajo (id) on delete cascade
) engine = InnoDB default charset = utf8mb4;

-- HU-059, HU-060, HU-069: responsables asignados a cada estado.
create table estado_responsable (
    id           binary(16)  not null,
    estado_id    binary(16)  not null,
    tipo_sujeto  varchar(8)  not null,
    sujeto_id    binary(16)  not null comment 'usuario, rol o area (auth_catalogs_db) o grupo_trabajo',
    asignado_por binary(16)  not null,
    asignado_en  datetime(6) not null,
    primary key (id),
    constraint uk_estado_responsable unique (estado_id, tipo_sujeto, sujeto_id),
    constraint fk_estado_responsable_estado foreign key (estado_id) references estado_flujo (id) on delete cascade,
    constraint ck_estado_responsable_tipo check (tipo_sujeto in ('USUARIO', 'GRUPO', 'ROL', 'AREA'))
) engine = InnoDB default charset = utf8mb4;

-- HU-056…HU-058: transiciones (acción + estado origen → estado destino).
create table transicion (
    id                 binary(16)  not null,
    version_id         binary(16)  not null,
    estado_origen_id   binary(16)  not null,
    estado_destino_id  binary(16)  not null,
    accion             varchar(16) not null,
    etiqueta           varchar(80) null comment 'Texto del botón en la bandeja',
    primary key (id),
    constraint uk_transicion_accion unique (estado_origen_id, accion),
    constraint fk_transicion_version foreign key (version_id) references flujo_version (id) on delete cascade,
    constraint fk_transicion_origen foreign key (estado_origen_id) references estado_flujo (id),
    constraint fk_transicion_destino foreign key (estado_destino_id) references estado_flujo (id),
    constraint ck_transicion_accion check (accion in ('APROBAR', 'DEVOLVER', 'CANCELAR', 'ENVIAR')),
    constraint ck_transicion_distinta check (estado_origen_id <> estado_destino_id)
) engine = InnoDB default charset = utf8mb4;

-- Bandeja de salida hacia ms-audit-infra (mismo patrón que los otros servicios).
create table evento_saliente (
    id                  binary(16)    not null,
    tipo                varchar(60)   not null,
    entidad             varchar(60)   not null,
    entidad_id          varchar(64)   null,
    actor_id            binary(16)    null,
    actor_correo        varchar(160)  null,
    datos               json          null,
    ocurrido_en         datetime(6)   not null,
    estado_publicacion  varchar(16)   not null default 'PENDIENTE',
    primary key (id),
    constraint ck_evento_saliente_estado check (estado_publicacion in ('PENDIENTE', 'PUBLICADO'))
) engine = InnoDB default charset = utf8mb4;

create index ix_evento_saliente_pendientes on evento_saliente (estado_publicacion, ocurrido_en);
