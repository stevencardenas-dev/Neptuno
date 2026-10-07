import { noEncontrado, prohibido, reglaInvalida } from '../errores.js';
import { fechaLocal } from './codigo.js';
import { esquemaCrear, esquemaEditar, esquemaFiltros, validar } from './validacion.js';

const PERMISO_RECIBIDO = 'radicados:radicar-recibido';
const PERMISO_CLASE = 'radicados:clase';

export function crearServicioRadicados({ repo, catalogos, ahora = () => new Date() }) {
  // Comprueba contra servicio-usuarios que lo referenciado exista y esté activo.
  async function validarCatalogos(actor, datos, origen) {
    if (datos.tipoDocumentalId) {
      const tipo = await catalogos.tipoDocumental(datos.tipoDocumentalId, actor.token);
      if (!tipo) throw reglaInvalida('El tipo documental no existe.');
      if (tipo.estado !== 'ACTIVO') throw reglaInvalida('El tipo documental está inactivo.');
      if (origen && !tipo.origenes.includes(origen)) {
        throw reglaInvalida(`El tipo documental "${tipo.nombre}" no admite documentos de origen ${origen}.`);
      }
    }
    if (datos.areaId) {
      const area = await catalogos.area(datos.areaId, actor.token);
      if (!area) throw reglaInvalida('El área no existe.');
      if (area.estado !== 'ACTIVO') throw reglaInvalida('El área está inactiva.');
    }
    if (datos.entidadId) {
      const entidad = await catalogos.entidad(datos.entidadId, actor.token);
      if (!entidad) throw reglaInvalida('La entidad no existe.');
      if (entidad.estado !== 'ACTIVO') throw reglaInvalida('La entidad está inactiva.');
    }
  }

  const evento = (tipo, actor, detalle) => (radicado) => ({
    tipo,
    entidad: 'radicado',
    entidadId: radicado.id,
    actorId: actor.id,
    actorCorreo: actor.correo,
    detalle: detalle(radicado),
  });

  return {
    /** HU-017, HU-018, HU-019, HU-024, HU-039, HU-040 */
    async crear(actor, cuerpo) {
      const datos = validar(esquemaCrear, cuerpo);
      // HU-024: Recibido solo lo registra quien tenga el permiso (rol Radicador).
      if (datos.origen === 'RECIBIDO' && !actor.permisos.has(PERMISO_RECIBIDO)) {
        throw prohibido('Solo el rol Radicador puede radicar documentos de origen Recibido.');
      }
      // HU-040: marcar un documento como Copia exige el permiso de clase.
      if (datos.clase === 'COPIA' && !actor.permisos.has(PERMISO_CLASE)) {
        throw prohibido('No tienes permiso para marcar un documento como Copia.');
      }
      const hoy = fechaLocal(ahora());
      if (datos.fechaDocumento > hoy) throw reglaInvalida('La fecha del documento no puede ser futura.');

      const areaId = datos.areaId ?? actor.areaId;
      await validarCatalogos(actor, { ...datos, areaId }, datos.origen);

      return repo.insertar(
        { ...datos, areaId, estado: 'RADICADO', radicadoPor: actor.id, radicadoEn: ahora() },
        { fecha: hoy },
        evento('radicado.creado', actor, (r) => `Se radicó el documento ${r.codigo} (${r.origen}): ${r.asunto}`),
      );
    },

    /** HU-020 */
    async obtener(id) {
      const radicado = await repo.obtener(id);
      if (!radicado) throw noEncontrado('El radicado no existe.');
      return radicado;
    },

    /** HU-023 */
    async listar(consulta) {
      const filtros = validar(esquemaFiltros, consulta);
      if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
        throw reglaInvalida('La fecha inicial no puede ser posterior a la final.');
      }
      return repo.buscar(filtros);
    },

    /** HU-021, HU-039, HU-040: edita los metadatos; el código nunca cambia. */
    async editar(actor, id, cuerpo) {
      const { version, ...cambios } = validar(esquemaEditar, cuerpo);
      const actual = await this.obtener(id);
      if (actual.estado === 'ANULADO') throw reglaInvalida('Un radicado anulado no se puede editar.');
      if (cambios.clase !== undefined && cambios.clase !== actual.clase && !actor.permisos.has(PERMISO_CLASE)) {
        throw prohibido('No tienes permiso para cambiar la clase del documento.');
      }
      if (cambios.fechaDocumento && cambios.fechaDocumento > fechaLocal(ahora())) {
        throw reglaInvalida('La fecha del documento no puede ser futura.');
      }
      // El tipo debe seguir admitiendo el origen del radicado, cambie o no el tipo.
      await validarCatalogos(actor, cambios, actual.origen);
      return repo.actualizar(
        id,
        version,
        { ...cambios, actualizadoPor: actor.id, actualizadoEn: ahora() },
        evento('radicado.editado', actor, (r) => `Se editaron los metadatos del radicado ${r.codigo}`),
      );
    },
  };
}
