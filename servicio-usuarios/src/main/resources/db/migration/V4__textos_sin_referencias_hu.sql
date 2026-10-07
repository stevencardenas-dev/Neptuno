-- Las descripciones del rol Administrador y del permiso radicados:radicar-recibido se
-- muestran en la interfaz: se quita la referencia interna "(HU-024)" de las bases ya sembradas.
update rol
set descripcion = replace(descripcion, ' (HU-024).', '.')
where nombre = 'Administrador';

update permiso
set descripcion = replace(descripcion, ' (HU-024).', '.')
where codigo = 'radicados:radicar-recibido';
