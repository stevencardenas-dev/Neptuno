-- El Radicador registra el documento y es quien lo pone en circulación (HU-062): se le
-- concede `flujo:iniciar`. El Administrador conserva el catálogo completo, y se le
-- asegura la concesión por si su rol se sembró antes de que existiera el permiso.
-- Idempotente, como las migraciones anteriores: si el permiso o la concesión ya existen,
-- no se duplican.

insert into permiso (id, codigo, nombre, modulo, descripcion)
select uuid_to_bin(uuid()), 'flujo:iniciar', 'Iniciar flujo', 'Flujo de trabajo',
       'Enviar un radicado a un flujo de trabajo activo.'
where not exists (select 1 from permiso where codigo = 'flujo:iniciar');

insert into rol_permiso (rol_id, permiso_id)
select r.id, p.id
  from rol r
  join permiso p on p.codigo = 'flujo:iniciar'
 where r.nombre in ('Radicador', 'Administrador')
   and not exists (
       select 1 from rol_permiso rp where rp.rol_id = r.id and rp.permiso_id = p.id
   );
