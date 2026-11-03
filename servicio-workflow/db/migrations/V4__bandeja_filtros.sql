-- ms-workflow-bpm · filtros de la bandeja (HU-064) e índice de los grupos de trabajo (HU-069).
-- V1…V3 ya corrieron: aquí solo se añade lo que falta. Cada sentencia se puede repetir
-- (el migrador salta lo que ya existe), así que una migración cortada se reanuda.

-- HU-064: la bandeja se filtra por tipo documental y origen. Se copian al abrir el
-- trámite, igual que el código y el asunto, para no depender de documentos en cada consulta.
alter table tramite add column tipo_documental_id binary(16) null comment 'HU-064: filtro de la bandeja' after radicado_asunto;
alter table tramite add column origen varchar(16) null comment 'HU-064: filtro de la bandeja' after tipo_documental_id;

alter table tramite add index ix_tramite_tipo (tipo_documental_id);
alter table tramite add index ix_tramite_origen (origen);

-- HU-069: los grupos de trabajo ya existen (V1); este índice acelera la bandeja.
alter table grupo_miembro add index ix_grupo_miembro_usuario (usuario_id);
