import { conflicto, noEncontrado, reglaInvalida } from '../errores.js';
import { esquemaCopia, validar } from './modelo.js';

/**
 * Copias informativas (HU-041, HU-042). Quien ve un radicado puede compartirlo con
 * otra persona; la copia aparece en la bandeja secundaria del destinatario y no
 * modifica el trámite ni el documento original.
 */
export function crearServicioCopias({ repo, catalogos }) {
  return {
    async enviar(actor, radicadoId, cuerpo) {
      const datos = validar(esquemaCopia, cuerpo);
      const radicado = await repo.radicado(radicadoId);
      if (!radicado) throw noEncontrado('El radicado no existe.');
      if (radicado.estado === 'ANULADO') throw conflicto('Un radicado anulado no admite copias.');
      if (datos.destinatarioId === actor.id) {
        throw reglaInvalida('No tiene sentido enviarte una copia a ti mismo.');
      }
      if (!(await catalogos.usuario(datos.destinatarioId, actor.token))) {
        throw reglaInvalida('El destinatario no existe o está inactivo.');
      }
      return repo.crear({ ...datos, radicadoId }, actor);
    },

    async bandeja(actor, consulta = {}) {
      const soloNoLeidas = String(consulta.noLeidas ?? '') === 'true';
      return repo.bandeja(actor.id, { soloNoLeidas });
    },

    async enviadas(radicadoId) {
      if (!(await repo.radicado(radicadoId))) throw noEncontrado('El radicado no existe.');
      return repo.enviadas(radicadoId);
    },

    async marcarLeida(actor, copiaId) {
      const copia = await repo.obtener(copiaId);
      if (!copia || copia.destinatarioId !== actor.id) throw noEncontrado('La copia no existe.');
      return repo.marcarLeida(copiaId, actor.id);
    },
  };
}
