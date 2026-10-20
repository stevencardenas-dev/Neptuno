-- HU-048…HU-051: el diseñador de flujos (ms-workflow-bpm) necesita un permiso propio.
-- El catálogo de permisos ya lo declara (CatalogoPermisos) y DatosIniciales lo insertaría
-- al arrancar, pero la concesión a un rol no se vuelve a hacer nunca: sembrarRol sale sin
-- tocar los roles que ya existen. Por eso aquí se crea el permiso (por si esta migración
-- corre antes de la primera siembra) y se le concede al Administrador, que es el único rol
-- que diseña flujos. Es idempotente.

insert into permiso (id, codigo, nombre, modulo, descripcion)
select uuid_to_bin(uuid()), 'flujo:disenar', 'Diseñar flujos', 'Flujo de trabajo',
       'Crear y editar la definición de un flujo de trabajo (HU-048…HU-051).'
where not exists (select 1 from permiso where codigo = 'flujo:disenar');

insert into rol_permiso (rol_id, permiso_id)
select r.id, p.id
  from rol r
  join permiso p on p.codigo = 'flujo:disenar'
 where r.nombre = 'Administrador'
   and not exists (
       select 1 from rol_permiso rp where rp.rol_id = r.id and rp.permiso_id = p.id
   );
