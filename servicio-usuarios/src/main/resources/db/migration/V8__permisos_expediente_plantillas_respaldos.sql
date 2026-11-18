-- Permisos de las historias del expediente, las plantillas y la operación
-- (HU-030…HU-038, HU-081, HU-082, HU-085). El catálogo de Java (CatalogoPermisos) ya los
-- declara y DatosIniciales los insertaría al arrancar, pero la concesión a un rol no se
-- vuelve a hacer nunca: sembrarRol no toca los roles que ya existen. Por eso aquí se
-- crean (por si la migración corre antes de la primera siembra) y se conceden.
-- Idempotente, como las migraciones anteriores.

insert into permiso (id, codigo, nombre, modulo, descripcion)
select uuid_to_bin(uuid()), 'expediente:administrar', 'Administrar carpetas del expediente', 'Expediente y auditoría',
       'Crear, editar y desactivar carpetas, subcarpetas y sus accesos (HU-030, HU-031, HU-033).'
where not exists (select 1 from permiso where codigo = 'expediente:administrar');

insert into permiso (id, codigo, nombre, modulo, descripcion)
select uuid_to_bin(uuid()), 'expediente:cargar', 'Cargar en el expediente', 'Expediente y auditoría',
       'Cargar documentos No radicables y anexos en una carpeta del expediente (HU-034).'
where not exists (select 1 from permiso where codigo = 'expediente:cargar');

insert into permiso (id, codigo, nombre, modulo, descripcion)
select uuid_to_bin(uuid()), 'plantillas:administrar', 'Administrar plantillas', 'Expediente y auditoría',
       'Subir y mantener las plantillas DOCX y sus variables (HU-035, HU-036).'
where not exists (select 1 from permiso where codigo = 'plantillas:administrar');

insert into permiso (id, codigo, nombre, modulo, descripcion)
select uuid_to_bin(uuid()), 'plantillas:usar', 'Usar plantillas', 'Expediente y auditoría',
       'Generar documentos y PDF a partir de una plantilla (HU-037, HU-038).'
where not exists (select 1 from permiso where codigo = 'plantillas:usar');

insert into permiso (id, codigo, nombre, modulo, descripcion)
select uuid_to_bin(uuid()), 'respaldos:administrar', 'Administrar respaldos y rendimiento', 'Expediente y auditoría',
       'Programar copias de seguridad, restaurarlas y ejecutar pruebas de carga (HU-081, HU-082, HU-085).'
where not exists (select 1 from permiso where codigo = 'respaldos:administrar');

-- El Administrador conserva el catálogo completo (menos radicar Recibido, HU-024).
insert into rol_permiso (rol_id, permiso_id)
select r.id, p.id
  from rol r
  join permiso p on p.codigo in ('expediente:administrar', 'expediente:cargar', 'plantillas:administrar',
                                 'plantillas:usar', 'respaldos:administrar')
 where r.nombre = 'Administrador'
   and not exists (
       select 1 from rol_permiso rp where rp.rol_id = r.id and rp.permiso_id = p.id
   );

-- Los perfiles operativos cargan en el expediente y usan plantillas; administrar carpetas
-- y plantillas queda en el Administrador.
insert into rol_permiso (rol_id, permiso_id)
select r.id, p.id
  from rol r
  join permiso p on p.codigo in ('expediente:cargar', 'plantillas:usar')
 where r.nombre in ('Radicador', 'Tesorero', 'Gerente', 'Aprobador')
   and not exists (
       select 1 from rol_permiso rp where rp.rol_id = r.id and rp.permiso_id = p.id
   );
