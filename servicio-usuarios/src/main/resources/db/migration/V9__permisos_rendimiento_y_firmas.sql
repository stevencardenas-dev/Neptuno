-- Permisos de la consulta de rendimiento y de firmas (HU-077, HU-084). El catálogo de
-- Java los declara y DatosIniciales los insertaría al arrancar, pero la concesión a un rol
-- no se vuelve a hacer nunca: sembrarRol no toca los roles que ya existen. Idempotente.

insert into permiso (id, codigo, nombre, modulo, descripcion)
select uuid_to_bin(uuid()), 'rendimiento:consultar', 'Consultar rendimiento', 'Expediente y auditoría',
       'Ver los tiempos de respuesta frente al límite de 2 s y el resultado de las pruebas de carga (HU-084, HU-085).'
where not exists (select 1 from permiso where codigo = 'rendimiento:consultar');

insert into permiso (id, codigo, nombre, modulo, descripcion)
select uuid_to_bin(uuid()), 'firma:consultar', 'Consultar firmas', 'Flujo de trabajo',
       'Ver las firmas electrónicas aplicadas a un trámite (HU-077).'
where not exists (select 1 from permiso where codigo = 'firma:consultar');

insert into rol_permiso (rol_id, permiso_id)
select r.id, p.id
  from rol r
  join permiso p on p.codigo in ('rendimiento:consultar', 'firma:consultar')
 where r.nombre = 'Administrador'
   and not exists (
       select 1 from rol_permiso rp where rp.rol_id = r.id and rp.permiso_id = p.id
   );

-- El Auditor consulta el rendimiento y las firmas sin poder modificarlas, que es su papel.
insert into rol_permiso (rol_id, permiso_id)
select r.id, p.id
  from rol r
  join permiso p on p.codigo in ('rendimiento:consultar', 'firma:consultar')
 where r.nombre = 'Auditor'
   and not exists (
       select 1 from rol_permiso rp where rp.rol_id = r.id and rp.permiso_id = p.id
   );
