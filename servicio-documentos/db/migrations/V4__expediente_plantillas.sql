-- ms-document-management · expediente y plantillas
-- (HU-030…HU-038).
-- Transcrito de docs/esquema-base-datos.sql, sección 1. Las referencias a otras bases
-- (área, rol, usuario, tipo documental) son lógicas, sin llave foránea.
-- La migración es reanudable: cada objeto se crea con "if not exists" y las llaves que
-- se añaden a tablas existentes se comprueban antes en information_schema.

-- HU-030, HU-031: árbol del expediente. Raíz = carpeta del área; hijas = subcarpetas.
create table if not exists carpeta (
    id                      binary(16)   not null,
    area_id                 binary(16)   not null comment 'Ref. lógica: area (auth_catalogs_db)',
    padre_id                binary(16)   null,
    nombre                  varchar(120) not null,
    tipo_expediente         varchar(80)  null comment 'HU-031',
    ruta                    varchar(500) not null comment 'Ruta materializada /Área/Subcarpeta (HU-032)',
    consecutivo_documentos  int          not null default 0 comment 'HU-034',
    estado                  varchar(16)  not null default 'ACTIVO',
    creado_por              binary(16)   not null,
    creado_en               datetime(6)  not null,
    actualizado_en          datetime(6)  null,
    raiz_area_id            binary(16)   generated always as (case when padre_id is null then area_id end) stored,
    primary key (id),
    constraint uk_carpeta_raiz_area unique (raiz_area_id),
    constraint uk_carpeta_nombre_hermana unique (padre_id, nombre),
    constraint fk_carpeta_padre foreign key (padre_id) references carpeta (id),
    constraint ck_carpeta_estado check (estado in ('ACTIVO', 'INACTIVO'))
) engine = InnoDB default charset = utf8mb4;

-- HU-033 (y HU-014): quién puede ver o cargar en cada carpeta, además del área dueña.
create table if not exists carpeta_acceso (
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

-- HU-034: documentos No radicables cargados directo a una carpeta.
create table if not exists documento_expediente (
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
create table if not exists plantilla (
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

create table if not exists plantilla_variable (
    id            binary(16)   not null,
    plantilla_id  binary(16)   not null,
    etiqueta      varchar(80)  not null comment 'Marcador en el documento, p. ej. {{asunto}}',
    campo_origen  varchar(80)  not null comment 'HU-037: metadato del radicado que la reemplaza',
    obligatoria   boolean      not null default true,
    primary key (id),
    constraint uk_plantilla_variable unique (plantilla_id, etiqueta),
    constraint fk_plantilla_variable_plantilla foreign key (plantilla_id) references plantilla (id) on delete cascade
) engine = InnoDB default charset = utf8mb4;

create table if not exists plantilla_origen (
    plantilla_id  binary(16)  not null,
    origen        varchar(16) not null,
    primary key (plantilla_id, origen),
    constraint fk_plantilla_origen_plantilla foreign key (plantilla_id) references plantilla (id) on delete cascade,
    constraint ck_plantilla_origen check (origen in ('INTERNO', 'EXTERNO'))
) engine = InnoDB default charset = utf8mb4;

-- HU-037, HU-038: cada render de plantilla y el PDF resultante.
create table if not exists documento_generado (
    id            binary(16)  not null,
    radicado_id   binary(16)  not null,
    plantilla_id  binary(16)  not null,
    plantilla_version int     not null,
    anexo_pdf_id  binary(16)  null,
    datos_render  json        not null,
    generado_por  binary(16)  not null,
    generado_en   datetime(6) not null,
    primary key (id),
    constraint fk_documento_generado_radicado foreign key (radicado_id) references radicado (id),
    constraint fk_documento_generado_plantilla foreign key (plantilla_id) references plantilla (id),
    constraint fk_documento_generado_anexo foreign key (anexo_pdf_id) references anexo (id)
) engine = InnoDB default charset = utf8mb4;

-- El radicado puede archivarse en una carpeta del expediente (HU-032).
set @agregar_carpeta = (select if(count(*) = 0,
    'alter table radicado add constraint fk_radicado_carpeta foreign key (carpeta_id) references carpeta (id)',
    'select 1')
  from information_schema.table_constraints
 where table_schema = database() and table_name = 'radicado' and constraint_name = 'fk_radicado_carpeta');
prepare agregar_carpeta from @agregar_carpeta;
execute agregar_carpeta;
deallocate prepare agregar_carpeta;

set @indice_carpeta = (select if(count(*) = 0,
    'alter table radicado add index ix_radicado_carpeta (carpeta_id)',
    'select 1')
  from information_schema.statistics
 where table_schema = database() and table_name = 'radicado' and index_name = 'ix_radicado_carpeta');
prepare indice_carpeta from @indice_carpeta;
execute indice_carpeta;
deallocate prepare indice_carpeta;

-- Los anexos también cuelgan de un documento del expediente (HU-034, HU-038).
set @fk_anexo_documento = (select if(count(*) = 0,
    'alter table anexo add constraint fk_anexo_documento foreign key (documento_expediente_id) references documento_expediente (id)',
    'select 1')
  from information_schema.table_constraints
 where table_schema = database() and table_name = 'anexo' and constraint_name = 'fk_anexo_documento');
prepare fk_anexo_documento from @fk_anexo_documento;
execute fk_anexo_documento;
deallocate prepare fk_anexo_documento;

set @ix_anexo_documento = (select if(count(*) = 0,
    'alter table anexo add index ix_anexo_documento (documento_expediente_id, eliminado_en)',
    'select 1')
  from information_schema.statistics
 where table_schema = database() and table_name = 'anexo' and index_name = 'ix_anexo_documento');
prepare ix_anexo_documento from @ix_anexo_documento;
execute ix_anexo_documento;
deallocate prepare ix_anexo_documento;
