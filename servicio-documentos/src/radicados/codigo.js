// HU-017: código de radicado AAAAMMDD + X + CONSECUTIVO.
// X es el dígito del origen, igual que en OrigenDocumento de servicio-usuarios.
export const DIGITO_ORIGEN = { INTERNO: '1', EXTERNO: '2', RECIBIDO: '3' };

const ZONA = 'America/Bogota';
const formatoFecha = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA });

/** Fecha calendario (AAAA-MM-DD) en la zona de la entidad, no en UTC. */
export function fechaLocal(instante) {
  return formatoFecha.format(instante);
}

export function formatearCodigo(fechaIso, digito, consecutivo) {
  return `${fechaIso.replaceAll('-', '')}${digito}${String(consecutivo).padStart(4, '0')}`;
}

/** Instante UTC en que empieza el día `fechaIso` en la zona de la entidad (UTC-5, sin horario de verano). */
export function inicioDiaLocal(fechaIso) {
  return new Date(`${fechaIso}T00:00:00-05:00`);
}
