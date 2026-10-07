-- HU-013: los permisos viajan dentro del token de acceso. Cuando cambian los roles
-- de un usuario o los permisos de uno de sus roles, se marca este momento y los
-- tokens de acceso emitidos antes dejan de aceptarse; el frontend los renueva con
-- el token de refresco y recibe los permisos vigentes.
alter table usuario add column permisos_actualizados_en datetime(6) null;
