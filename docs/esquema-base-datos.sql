-- =============================================================================
-- Neptuno · Esquema de base de datos de las historias pendientes
-- =============================================================================
--
-- Cubre las 68 historias de usuario que aún no están implementadas, repartidas
-- según Neptuno_Proyecto.docx (una base MySQL 8 por microservicio):
--
--   document_management_db  ms-document-management  HU-017…HU-021, HU-023…HU-042
--   workflow_bpm_db         ms-workflow-bpm         HU-048…HU-080, HU-083
--   audit_infra_db          ms-audit-infra          HU-043…HU-047, HU-081, HU-082,
--                                                   HU-084, HU-085
--
-- auth_catalogs_db (ms-auth-catalogs, HU-001…HU-016 y HU-022) ya existe: su
-- esquema vive en servicio-usuarios/src/main/resources/db/migration y no se
-- repite aquí. Al final de este archivo se listan los permisos nuevos que las
-- historias pendientes necesitarán en ese catálogo.
--
-- Convenciones (las mismas de auth_catalogs_db):
--   * Identificadores UUID en binary(16); fechas en datetime(6) UTC.
--   * Enumeraciones como varchar con CHECK, para que agregar un valor no exija
--     alterar un tipo ENUM.
--   * Cada microservicio es dueño de sus datos: las columnas que apuntan a otra
--     base (usuario_id, area_id, rol_id, radicado_id…) son referencias lógicas,
--     sin llave foránea, y se resuelven por API REST.
--   * Cada base tiene su tabla evento_saliente (patrón transactional outbox) para
--     publicar en RabbitMQ los eventos que consume ms-audit-infra.
--
-- Solo define estructura: no implementa ninguna historia ni carga datos.
-- =============================================================================


-- #############################################################################
-- 1. document_management_db · ms-document-management
-- #############################################################################

create database if not exists document_management_db
    default character set utf8mb4 collate utf8mb4_0900_ai_ci;
use document_management_db;

-- HU-017: consecutivo diario por origen para el código AAAAMMDD + X + CONSECUTIVO.
-- Se incrementa con select ... for update dentro de la transacción del radicado.
create table consecutivo_radicado (
    fecha          date       not null,
    origen_digito  char(1)    not null comment 'X del código: dígito del origen (catálogo de orígenes de ms-auth-catalogs)',
    ultimo         int        not null default 0,
    primary key (fecha, origen_digito)
) engine = InnoDB default charset = utf8mb4;

-- HU-030, HU-031: árbol del expediente. Raíz = carpeta del área; hijas = subcarpetas temáticas.
create table carpeta (
    id                      binary(16)   not null,
    area_id                 binary(16)   not null comment 'Ref. lógica: area (auth_catalogs_db)',
    padre_id                binary(16)   null,
    nombre                  varchar(120) not null,
    tipo_expediente         varchar(80)  null comment 'HU-031: tipo de expediente de la subcarpeta',
    ruta                    varchar(500) not null comment 'Ruta materializada /Área/Subcarpeta para consultar el árbol (HU-032)',
    consecutivo_documentos  int          not null default 0 comment 'HU-034: consecutivo de documentos No radicables',
    estado                  varchar(16)  not null default 'ACTIVO',
    creado_por              binary(16)   not null,
    creado_en               datetime(6)  not null,
    actualizado_en          datetime(6)  null,
    -- Una sola carpeta raíz por área (MySQL no tiene índices parciales).
    raiz_area_id            binary(16)   generated always as (case when padre_id is null then area_id end) stored,
    primary key (id),
    constraint uk_carpeta_raiz_area unique (raiz_area_id),
    constraint uk_carpeta_nombre_hermana unique (padre_id, nombre),
    constraint fk_carpeta_padre foreign key (padre_id) references carpeta (id),
    constraint ck_carpeta_estado check (estado in ('ACTIVO', 'INACTIVO'))
) engine = InnoDB default charset = utf8mb4;

-- HU-033 (y HU-014): quién puede ver o cargar en cada carpeta, además del área dueña.
create table carpeta_acceso (
    id             binary(16)  not null,
    carpeta_id     binary(16)  not null,
    tipo_sujeto    varchar(8)  not null,
    sujeto_id      binary(16)  not null comment 'Ref. lógica: rol o area (auth_catalogs_db)',
    nivel          varchar(12) not null,
    creado_por     binary(16)  not null,
    creado_en      datetime(6) not null,
    primary key (id),
    constraint uk_carpeta_acceso unique (carpeta_id, tipo_sujeto, sujeto_id),
    constraint fk_carpeta_acceso_carpeta foreign key (carpeta_id) references carpeta (id),
    constraint ck_carpeta_acceso_sujeto check (tipo_sujeto in ('ROL', 'AREA')),
    constraint ck_carpeta_acceso_nivel check (nivel in ('VER', 'CARGAR', 'ADMINISTRAR'))
) engine = InnoDB default charset = utf8mb4;

-- HU-017…HU-021, HU-023, HU-024, HU-039, HU-040: el radicado y sus metadatos.
create table radicado (
    id                  binary(16)    not null,
    codigo              varchar(20)   not null comment 'HU-017: AAAAMMDD + X + CONSECUTIVO, inmutable (HU-021)',
    origen              varchar(16)   not null comment 'HU-018; RECIBIDO exige radicados:radicar-recibido (HU-024)',
    clase               varchar(8)    not null default 'ORIGINAL' comment 'HU-040',
    tipo_documental_id  binary(16)    not null comment 'Ref. lógica: tipo_documental (auth_catalogs_db)',
    area_id             binary(16)    not null comment 'Ref. lógica: area responsable (auth_catalogs_db)',
    -- HU-019: metadatos obligatorios
    asunto              varchar(300)  not null,
    remitente           varchar(160)  not null,
    destinatario        varchar(160)  not null,
    fecha_documento     date          not null,
    folios              int           not null default 1,
    -- HU-039: metadatos extendidos
    entidad_id          binary(16)    null comment 'Ref. lógica: entidad con NIT y razón social (auth_catalogs_db)',
    carpeta_id          binary(16)    null comment 'Carpeta del expediente donde se archiva',
    comentarios         varchar(2000) null,
    estado              varchar(16)   not null default 'RADICADO',
    radicado_por        binary(16)    not null,
    radicado_en         datetime(6)   not null,
    actualizado_por     binary(16)    null,
    actualizado_en      datetime(6)   null,
    version             int           not null default 0 comment 'Bloqueo optimista en la edición (HU-021)',
    primary key (id),
    constraint uk_radicado_codigo unique (codigo),
    constraint fk_radicado_carpeta foreign key (carpeta_id) references carpeta (id),
    constraint ck_radicado_origen check (origen in ('INTERNO', 'EXTERNO', 'RECIBIDO')),
    constraint ck_radicado_clase check (clase in ('ORIGINAL', 'COPIA')),
    constraint ck_radicado_estado check (estado in ('RADICADO', 'EN_TRAMITE', 'FINALIZADO', 'ANULADO')),
    constraint ck_radicado_folios check (folios > 0)
) engine = InnoDB default charset = utf8mb4;

-- HU-023: filtros del buscador (código, fechas, origen, tipo y área).
create index ix_radicado_radicado_en on radicado (radicado_en);
create index ix_radicado_area_fecha on radicado (area_id, radicado_en);
create index ix_radicado_tipo on radicado (tipo_documental_id);
create index ix_radicado_origen_fecha on radicado (origen, radicado_en);
create index ix_radicado_carpeta on radicado (carpeta_id);

-- HU-034: documentos No radicables cargados directo a una carpeta del expediente.
create table documento_expediente (
    id              binary(16)   not null,
    carpeta_id      binary(16)   not null,
    consecutivo     int          not null comment 'Tomado de carpeta.consecutivo_documentos',
    titulo          varchar(200) not null,
    descripcion     varchar(1000) null,
    cargado_por     binary(16)   not null,
    cargado_en      datetime(6)  not null,
    primary key (id),
    constraint uk_documento_expediente_consecutivo unique (carpeta_id, consecutivo),
    constraint fk_documento_expediente_carpeta foreign key (carpeta_id) references carpeta (id)
) engine = InnoDB default charset = utf8mb4;

-- HU-035, HU-036: plantillas DOCX con variables y orígenes permitidos.
create table plantilla (
    id              binary(16)   not null,
    nombre          varchar(120) not null,
    descripcion     varchar(500) null,
    objeto_clave    varchar(300) not null comment 'Clave del archivo DOCX en MinIO',
    version         int          not null default 1,
    estado          varchar(16)  not null default 'ACTIVA',
    creado_por      binary(16)   not null,
    creado_en       datetime(6)  not null,
    actualizado_en  datetime(6)  null,
    primary key (id),
    constraint uk_plantilla_nombre unique (nombre),
    constraint ck_plantilla_estado check (estado in ('ACTIVA', 'INACTIVA'))
) engine = InnoDB default charset = utf8mb4;

create table plantilla_variable (
    id            binary(16)   not null,
    plantilla_id  binary(16)   not null,
    etiqueta      varchar(80)  not null comment 'Marcador en el documento, p. ej. {{asunto}}',
    campo_origen  varchar(80)  not null comment 'HU-037: metadato del radicado que la reemplaza',
    obligatoria   boolean      not null default true,
    primary key (id),
    constraint uk_plantilla_variable unique (plantilla_id, etiqueta),
    constraint fk_plantilla_variable_plantilla foreign key (plantilla_id) references plantilla (id) on delete cascade
) engine = InnoDB default charset = utf8mb4;

-- HU-036: una plantilla solo se vincula a los orígenes Interno o Externo.
create table plantilla_origen (
    plantilla_id  binary(16)  not null,
    origen        varchar(16) not null,
    primary key (plantilla_id, origen),
    constraint fk_plantilla_origen_plantilla foreign key (plantilla_id) references plantilla (id) on delete cascade,
    constraint ck_plantilla_origen check (origen in ('INTERNO', 'EXTERNO'))
) engine = InnoDB default charset = utf8mb4;

-- HU-025…HU-029, HU-038: archivos en MinIO de un radicado o de un documento del expediente.
create table anexo (
    id                       binary(16)    not null,
    radicado_id              binary(16)    null,
    documento_expediente_id  binary(16)    null,
    nombre_original          varchar(255)  not null,
    extension                varchar(8)    not null comment 'HU-026',
    tipo_mime                varchar(120)  not null,
    tamano_bytes             bigint        not null,
    objeto_clave             varchar(300)  not null comment 'Clave del objeto en MinIO',
    hash_sha256              char(64)      not null,
    procedencia              varchar(12)   not null default 'CARGA' comment 'CARGA o PLANTILLA (PDF generado, HU-038)',
    cargado_por              binary(16)    not null,
    cargado_en               datetime(6)   not null,
    -- HU-029: eliminación lógica con constancia
    eliminado_en             datetime(6)   null,
    eliminado_por            binary(16)    null,
    motivo_eliminacion       varchar(500)  null,
    primary key (id),
    constraint uk_anexo_objeto unique (objeto_clave),
    constraint fk_anexo_radicado foreign key (radicado_id) references radicado (id),
    constraint fk_anexo_documento foreign key (documento_expediente_id) references documento_expediente (id),
    -- Pertenece a un radicado o a un documento del expediente, nunca a ambos.
    constraint ck_anexo_duenio check ((radicado_id is null) <> (documento_expediente_id is null)),
    constraint ck_anexo_extension check (extension in ('pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx')),
    constraint ck_anexo_tamano check (tamano_bytes > 0),
    constraint ck_anexo_procedencia check (procedencia in ('CARGA', 'PLANTILLA')),
    constraint ck_anexo_eliminacion check (eliminado_en is null or motivo_eliminacion is not null)
) engine = InnoDB default charset = utf8mb4;

create index ix_anexo_radicado on anexo (radicado_id, eliminado_en);

-- HU-037, HU-038: cada render de plantilla y el PDF resultante.
create table documento_generado (
    id            binary(16)  not null,
    radicado_id   binary(16)  not null,
    plantilla_id  binary(16)  not null,
    plantilla_version int     not null,
    anexo_pdf_id  binary(16)  null comment 'Anexo con el PDF final (HU-038)',
    datos_render  json        not null comment 'Valores usados para reemplazar las variables',
    generado_por  binary(16)  not null,
    generado_en   datetime(6) not null,
    primary key (id),
    constraint fk_documento_generado_radicado foreign key (radicado_id) references radicado (id),
    constraint fk_documento_generado_plantilla foreign key (plantilla_id) references plantilla (id),
    constraint fk_documento_generado_anexo foreign key (anexo_pdf_id) references anexo (id)
) engine = InnoDB default charset = utf8mb4;

-- HU-041, HU-042: copias informativas y la bandeja secundaria de cada destinatario.
create table copia_informativa (
    id               binary(16)   not null,
    radicado_id      binary(16)   not null,
    destinatario_id  binary(16)   not null comment 'Ref. lógica: usuario (auth_catalogs_db)',
    mensaje          varchar(500) null,
    enviada_por      binary(16)   not null,
    enviada_en       datetime(6)  not null,
    leida_en         datetime(6)  null,
    primary key (id),
    constraint uk_copia_destinatario unique (radicado_id, destinatario_id),
    constraint fk_copia_radicado foreign key (radicado_id) references radicado (id)
) engine = InnoDB default charset = utf8mb4;

create index ix_copia_bandeja on copia_informativa (destinatario_id, leida_en, enviada_en);

-- Outbox de eventos hacia ms-audit-infra (radicado.creado, anexo.eliminado, copia.enviada…).
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


-- #############################################################################
-- 2. workflow_bpm_db · ms-workflow-bpm
-- #############################################################################

create database if not exists workflow_bpm_db
    default character set utf8mb4 collate utf8mb4_0900_ai_ci;
use workflow_bpm_db;

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
    estado               varchar(16)  not null default 'BORRADOR',
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

-- HU-062, HU-071, HU-072, HU-079: instancia del flujo para un radicado.
create table tramite (
    id                    binary(16)  not null,
    radicado_id           binary(16)  not null comment 'Ref. lógica: radicado (document_management_db)',
    flujo_version_id      binary(16)  not null comment 'HU-079: queda fija aunque se publique otra versión',
    estado_actual_id      binary(16)  not null,
    estado                varchar(12) not null default 'EN_CURSO',
    poseedor_original_id  binary(16)  null comment 'HU-071: único usuario con la tenencia del Original',
    iniciado_por          binary(16)  not null,
    iniciado_en           datetime(6) not null,
    vence_en              datetime(6) null comment 'HU-072: iniciado_en + sla_global_minutos',
    finalizado_en         datetime(6) null,
    version               int         not null default 0 comment 'Bloqueo optimista (HU-071)',
    -- Un radicado solo puede tener un trámite en curso.
    radicado_en_curso_id  binary(16)  generated always as (case when estado = 'EN_CURSO' then radicado_id end) stored,
    primary key (id),
    constraint uk_tramite_radicado_en_curso unique (radicado_en_curso_id),
    constraint fk_tramite_version foreign key (flujo_version_id) references flujo_version (id),
    constraint fk_tramite_estado_actual foreign key (estado_actual_id) references estado_flujo (id),
    constraint ck_tramite_estado check (estado in ('EN_CURSO', 'FINALIZADO', 'CANCELADO'))
) engine = InnoDB default charset = utf8mb4;

create index ix_tramite_radicado on tramite (radicado_id);

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
    version          int           not null default 0 comment 'Bloqueo optimista: dos usuarios no toman la misma tarea',
    primary key (id),
    constraint fk_tarea_tramite foreign key (tramite_id) references tramite (id),
    constraint fk_tarea_estado foreign key (estado_flujo_id) references estado_flujo (id),
    constraint ck_tarea_estado check (estado in ('PENDIENTE', 'TOMADA', 'COMPLETADA', 'CANCELADA')),
    constraint ck_tarea_tomada check (estado <> 'TOMADA' or asignada_a is not null)
) engine = InnoDB default charset = utf8mb4;

-- HU-063, HU-064, HU-074: bandeja pendiente ordenada por vencimiento.
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
    ocurrido_en        datetime(6)   not null,
    primary key (id),
    constraint fk_movimiento_tramite foreign key (tramite_id) references tramite (id),
    constraint fk_movimiento_tarea foreign key (tarea_id) references tarea (id),
    constraint fk_movimiento_transicion foreign key (transicion_id) references transicion (id),
    constraint ck_movimiento_accion check (accion in ('INICIAR', 'APROBAR', 'DEVOLVER', 'CANCELAR', 'ENVIAR', 'TOMAR', 'LIBERAR')),
    -- HU-067, HU-068: cancelar o devolver exige observación.
    constraint ck_movimiento_observacion check (accion not in ('CANCELAR', 'DEVOLVER') or observacion is not null)
) engine = InnoDB default charset = utf8mb4;

create index ix_movimiento_tramite on movimiento_tramite (tramite_id, ocurrido_en);

-- HU-075, HU-077: firmas electrónicas aplicadas en los estados que la exigen.
create table firma (
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


-- #############################################################################
-- 3. audit_infra_db · ms-audit-infra
-- #############################################################################

create database if not exists audit_infra_db
    default character set utf8mb4 collate utf8mb4_0900_ai_ci;
use audit_infra_db;

-- HU-043…HU-047, HU-077: bitácora inalterable alimentada por RabbitMQ.
-- Cada registro guarda el hash del anterior (cadena verificable, HU-044).
create table registro_bitacora (
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
    constraint uk_bitacora_hash unique (hash)
) engine = InnoDB default charset = utf8mb4;

-- HU-046, HU-047: historial por documento y filtros por usuario, fecha y acción.
create index ix_bitacora_radicado on registro_bitacora (radicado_id, ocurrido_en);
create index ix_bitacora_actor on registro_bitacora (actor_id, ocurrido_en);
create index ix_bitacora_tipo on registro_bitacora (tipo_evento, ocurrido_en);
create index ix_bitacora_fecha on registro_bitacora (ocurrido_en);

-- HU-044: la base rechaza cualquier modificación o borrado de la bitácora.
create trigger tr_bitacora_sin_update before update on registro_bitacora
for each row signal sqlstate '45000' set message_text = 'La bitácora es inalterable: no se permite modificar registros (HU-044).';

create trigger tr_bitacora_sin_delete before delete on registro_bitacora
for each row signal sqlstate '45000' set message_text = 'La bitácora es inalterable: no se permite eliminar registros (HU-044).';

-- HU-081: programación de copias de seguridad periódicas.
create table programacion_respaldo (
    id                  binary(16)  not null,
    frecuencia          varchar(16) not null,
    hora                time        not null,
    retencion_dias      int         not null,
    incluye_documentos  boolean     not null default true comment 'Objetos de MinIO',
    incluye_bitacora    boolean     not null default true,
    activa              boolean     not null default true,
    actualizado_por     binary(16)  not null,
    actualizado_en      datetime(6) not null,
    primary key (id),
    constraint ck_programacion_frecuencia check (frecuencia in ('DIARIA', 'CADA_12_HORAS', 'SEMANAL')),
    constraint ck_programacion_retencion check (retencion_dias > 0)
) engine = InnoDB default charset = utf8mb4;

-- HU-081: cada copia ejecutada.
create table respaldo (
    id                binary(16)    not null,
    programacion_id   binary(16)    null comment 'null = respaldo manual',
    estado            varchar(12)   not null default 'EN_CURSO',
    bases_incluidas   json          not null comment 'Bases de datos y buckets copiados',
    ubicacion         varchar(300)  null comment 'Clave del respaldo en el almacenamiento',
    tamano_bytes      bigint        null,
    checksum_sha256   char(64)      null,
    iniciado_por      binary(16)    null comment 'null = ejecutado por la programación',
    iniciado_en       datetime(6)   not null,
    finalizado_en     datetime(6)   null,
    expira_en         datetime(6)   null comment 'Según retencion_dias',
    mensaje_error     varchar(1000) null,
    primary key (id),
    constraint fk_respaldo_programacion foreign key (programacion_id) references programacion_respaldo (id),
    constraint ck_respaldo_estado check (estado in ('EN_CURSO', 'COMPLETADO', 'FALLIDO', 'EXPIRADO'))
) engine = InnoDB default charset = utf8mb4;

create index ix_respaldo_fecha on respaldo (iniciado_en);

-- HU-082: restauraciones, con quien las pidió y quien las confirmó.
create table restauracion (
    id              binary(16)    not null,
    respaldo_id     binary(16)    not null,
    estado          varchar(12)   not null default 'SOLICITADA',
    motivo          varchar(500)  not null,
    solicitada_por  binary(16)    not null,
    solicitada_en   datetime(6)   not null,
    confirmada_por  binary(16)    null,
    iniciada_en     datetime(6)   null,
    finalizada_en   datetime(6)   null,
    resultado       varchar(1000) null,
    primary key (id),
    constraint fk_restauracion_respaldo foreign key (respaldo_id) references respaldo (id),
    constraint ck_restauracion_estado check (estado in ('SOLICITADA', 'EN_CURSO', 'COMPLETADA', 'FALLIDA', 'CANCELADA'))
) engine = InnoDB default charset = utf8mb4;

-- HU-084: mediciones de tiempos de respuesta frente al límite de 2 s.
create table medicion_rendimiento (
    id             binary(16)   not null,
    servicio       varchar(40)  not null,
    metodo         varchar(8)   not null,
    ruta           varchar(200) not null,
    ventana_desde  datetime(6)  not null,
    ventana_hasta  datetime(6)  not null,
    solicitudes    int          not null,
    p50_ms         int          not null,
    p95_ms         int          not null,
    p99_ms         int          not null,
    limite_ms      int          not null default 2000,
    cumple         boolean      generated always as (p95_ms <= limite_ms) stored,
    primary key (id),
    constraint ck_medicion_ventana check (ventana_hasta > ventana_desde)
) engine = InnoDB default charset = utf8mb4;

create index ix_medicion_servicio on medicion_rendimiento (servicio, ventana_desde);

-- HU-085: ejecuciones de pruebas de carga con N usuarios concurrentes.
create table prueba_carga (
    id                     binary(16)   not null,
    escenario              varchar(120) not null,
    herramienta            varchar(20)  not null,
    usuarios_concurrentes  int          not null,
    duracion_segundos      int          not null,
    total_solicitudes      int          not null,
    solicitudes_fallidas   int          not null,
    solicitudes_por_seg    decimal(10,2) not null,
    p95_ms                 int          not null,
    p99_ms                 int          not null,
    limite_ms              int          not null default 2000,
    cumple                 boolean      generated always as (p95_ms <= limite_ms) stored,
    reporte_clave          varchar(300) null comment 'Reporte HTML/JSON guardado en MinIO',
    ejecutada_por          binary(16)   not null,
    ejecutada_en           datetime(6)  not null,
    primary key (id),
    constraint ck_prueba_herramienta check (herramienta in ('K6', 'GATLING', 'JMETER')),
    constraint ck_prueba_usuarios check (usuarios_concurrentes > 0)
) engine = InnoDB default charset = utf8mb4;


-- #############################################################################
-- 4. Notas para las historias que no generan tablas propias
-- #############################################################################
--
-- HU-024  Solo el rol Radicador radica Recibidos: regla de autorización con el
--         permiso radicados:radicar-recibido (ya existe en auth_catalogs_db).
-- HU-026  Formatos permitidos: ck_anexo_extension, más la validación de MIME en el API.
-- HU-033  Visibilidad del expediente: carpeta_acceso + contexto de acceso de
--         GET /api/usuarios/interno/usuarios/{id}/contexto-acceso (HU-014).
-- HU-052  Lienzo gráfico: estado_flujo.posicion_x / posicion_y.
-- HU-074  Semáforo: se calcula al consultar comparando tarea.vence_en con la hora
--         actual; no se guarda para que nunca quede desactualizado.
-- HU-083  Uso desde el celular: requisito del frontend, sin tablas.
--
-- Permisos nuevos que habría que sembrar en auth_catalogs_db.permiso para proteger
-- los endpoints de estas historias (ver la hoja Product Backlog del Excel):
--   radicados:consultar, expediente:administrar, expediente:cargar,
--   plantillas:administrar, plantillas:usar, flujos:administrar, respaldos:administrar
