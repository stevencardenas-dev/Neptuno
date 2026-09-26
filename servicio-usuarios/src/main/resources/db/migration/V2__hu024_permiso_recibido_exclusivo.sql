-- HU-024: radicar documentos de origen Recibido es exclusivo del rol Radicador.
-- La siembra inicial (DatosIniciales) ya excluye ese permiso del rol Administrador;
-- esta migración corrige las bases que se sembraron antes con los 25 permisos.
delete from rol_permiso
where permiso_id = (select id from permiso where codigo = 'radicados:radicar-recibido')
  and rol_id = (select id from rol where nombre = 'Administrador');
