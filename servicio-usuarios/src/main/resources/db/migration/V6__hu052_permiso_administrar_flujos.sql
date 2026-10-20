-- El permiso del diseñador de flujos toma el código con el que el backlog lo nombra
-- (HU-050, HU-052…HU-061: `flujos:administrar`) y su descripción deja de citar historias,
-- porque el nombre y la descripción del permiso se ven en la pantalla de roles (mismo
-- ajuste que la migración V4). Es idempotente: se puede aplicar sobre la base que ya
-- tenía `flujo:disenar` y sobre una base recién sembrada con el código nuevo.

update permiso
   set codigo = 'flujos:administrar',
       nombre = 'Administrar flujos',
       descripcion = 'Crear y mantener los flujos de trabajo: sus pasos, sus decisiones y su publicación.'
 where codigo = 'flujo:disenar';

insert into permiso (id, codigo, nombre, modulo, descripcion)
select uuid_to_bin(uuid()), 'flujos:administrar', 'Administrar flujos', 'Flujo de trabajo',
       'Crear y mantener los flujos de trabajo: sus pasos, sus decisiones y su publicación.'
where not exists (select 1 from permiso where codigo = 'flujos:administrar');

-- El Administrador es el único rol que diseña flujos; la concesión sigue al permiso.
insert into rol_permiso (rol_id, permiso_id)
select r.id, p.id
  from rol r
  join permiso p on p.codigo = 'flujos:administrar'
 where r.nombre = 'Administrador'
   and not exists (
       select 1 from rol_permiso rp where rp.rol_id = r.id and rp.permiso_id = p.id
   );
