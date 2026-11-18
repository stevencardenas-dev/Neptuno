import { randomUUID } from 'node:crypto';
import { ErrorApi, conflicto, noEncontrado, reglaInvalida } from '../errores.js';
import { crearPdf, marcadoresDeDocx, renderizarDocx, textoDeDocx } from './documento.js';
import {
  CAMPOS_RADICADO,
  esquemaGenerar,
  esquemaOrigenes,
  esquemaPlantillaEditar,
  esquemaVariables,
  validar,
  validarDocx,
} from './modelo.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';
const ORIGENES_POR_DEFECTO = ['INTERNO', 'EXTERNO'];

/**
 * Plantillas DOCX (HU-035…HU-038). Se sube el DOCX con marcadores `{{campo}}`, se
 * declaran sus variables y orígenes permitidos, y al generar se reemplazan los valores
 * del radicado (más los que envíe la persona) y se producen DOCX y PDF como anexos.
 */
export function crearServicioPlantillas({ repo, anexos, almacen }) {
  async function exigirPlantilla(id) {
    const plantilla = await repo.obtener(id);
    if (!plantilla) throw noEncontrado('La plantilla no existe.');
    return plantilla;
  }

  function variablesAutomaticas(marcadores) {
    return marcadores.map((etiqueta) => ({
      etiqueta,
      campoOrigen: CAMPOS_RADICADO.includes(etiqueta) ? etiqueta : etiqueta,
      obligatoria: true,
    }));
  }

  return {
    /** HU-035: listar plantillas con sus orígenes y número de variables. */
    async listar() {
      return repo.listar();
    },

    async obtener(id) {
      const plantilla = await exigirPlantilla(id);
      const { objetoClave: _clave, ...publica } = plantilla;
      return publica;
    },

    /** HU-035: subir el DOCX y detectar sus variables. */
    async crear(actor, archivo, metadatos) {
      const { nombreOriginal, tipoMime } = validarDocx(archivo);
      const nombre = String(metadatos.nombre ?? nombreOriginal.replace(/\.docx$/i, '')).trim();
      if (nombre.length < 3 || nombre.length > 120) {
        throw reglaInvalida('El nombre de la plantilla debe tener entre 3 y 120 caracteres.');
      }
      if (await repo.existeNombre(nombre)) throw conflicto(`Ya existe una plantilla llamada «${nombre}».`);
      const origenes = metadatos.origenes?.length ? metadatos.origenes : ORIGENES_POR_DEFECTO;
      const permitidos = validar(esquemaOrigenes, { origenes });
      const marcadores = await marcadoresDeDocx(archivo.contenido);
      const objetoClave = `plantillas/${randomUUID()}.docx`;

      try {
        await almacen.guardar(objetoClave, archivo.contenido, tipoMime);
      } catch (error) {
        console.error('No se pudo guardar la plantilla en MinIO:', error.message);
        throw ErrorAlmacen();
      }
      try {
        return await repo.crear(
          {
            nombre,
            descripcion: metadatos.descripcion ?? null,
            objetoClave,
            variables: variablesAutomaticas(marcadores),
            origenes: permitidos.origenes,
          },
          actor,
        );
      } catch (error) {
        await almacen.eliminar?.(objetoClave).catch(() => {});
        throw error;
      }
    },

    /** HU-035: nombre, descripción y estado de la plantilla. */
    async editar(actor, id, cuerpo) {
      const plantilla = await exigirPlantilla(id);
      const datos = validar(esquemaPlantillaEditar, cuerpo);
      const nombre = datos.nombre ?? plantilla.nombre;
      if (nombre !== plantilla.nombre && (await repo.existeNombre(nombre, id))) {
        throw conflicto(`Ya existe una plantilla llamada «${nombre}».`);
      }
      return repo.actualizar(id, {
        nombre,
        descripcion: datos.descripcion === undefined ? plantilla.descripcion : datos.descripcion,
        estado: datos.estado ?? plantilla.estado,
      }, actor);
    },

    /** HU-036: variables y campo del radicado que precarga cada una. */
    async reemplazarVariables(actor, id, cuerpo) {
      const plantilla = await exigirPlantilla(id);
      const { variables } = validar(esquemaVariables, cuerpo);
      let contenido;
      try {
        contenido = await almacen.leer(plantilla.objetoClave);
      } catch {
        throw ErrorAlmacen();
      }
      const marcadores = new Set(await marcadoresDeDocx(contenido));
      const inventadas = variables.filter((variable) => !marcadores.has(variable.etiqueta));
      if (inventadas.length) {
        throw reglaInvalida('Hay variables que no existen en el documento.', inventadas.map((v) => `{{${v.etiqueta}}}`));
      }
      return repo.reemplazarVariables(id, variables, actor);
    },

    /** HU-036: la plantilla solo se usa con los orígenes vinculados. */
    async reemplazarOrigenes(actor, id, cuerpo) {
      await exigirPlantilla(id);
      const { origenes } = validar(esquemaOrigenes, cuerpo);
      return repo.reemplazarOrigenes(id, origenes, actor);
    },

    /** HU-037, HU-038: renderiza, produce DOCX y PDF, y los anexa al radicado. */
    async generar(actor, radicadoId, cuerpo) {
      const { plantillaId, datos } = validar(esquemaGenerar, cuerpo);
      const plantilla = await exigirPlantilla(plantillaId);
      if (plantilla.estado !== 'ACTIVA') throw reglaInvalida('La plantilla está inactiva.');
      const radicado = await repo.radicado(radicadoId);
      if (!radicado) throw noEncontrado('El radicado no existe.');
      if (!plantilla.origenes.includes(radicado.origen)) {
        throw reglaInvalida(`La plantilla no está vinculada al origen ${radicado.origen} del radicado.`);
      }

      const valores = {};
      const faltantes = [];
      for (const variable of plantilla.variables) {
        const valor = datos[variable.etiqueta] ?? datos[variable.campoOrigen] ?? radicado[variable.campoOrigen];
        if (valor === undefined || valor === null || String(valor).trim() === '') {
          if (variable.obligatoria) faltantes.push(variable.etiqueta);
          else valores[variable.etiqueta] = '';
        } else {
          valores[variable.etiqueta] = String(valor);
        }
      }
      if (faltantes.length) {
        throw reglaInvalida('Faltan datos para generar el documento.', faltantes.map((etiqueta) => `{{${etiqueta}}}`));
      }

      let original;
      try {
        original = await almacen.leer(plantilla.objetoClave);
      } catch (error) {
        console.error('No se pudo leer la plantilla de MinIO:', error.message);
        throw ErrorAlmacen();
      }
      const docx = await renderizarDocx(original, valores);
      const pdf = crearPdf(await textoDeDocx(docx), plantilla.nombre);
      const base = `${plantilla.nombre} - ${radicado.codigo}`.replace(/[\\/:*?"<>|]/g, '-');
      const [anexoDocx, anexoPdf] = await anexos.cargarGenerados(actor, radicadoId, [
        { nombre: `${base}.docx`, tipoMime: DOCX_MIME, contenido: docx },
        { nombre: `${base}.pdf`, tipoMime: PDF_MIME, contenido: pdf },
      ]);
      const generado = await repo.crearGenerado(
        {
          radicadoId,
          plantillaId,
          plantillaNombre: plantilla.nombre,
          version: plantilla.version,
          anexoPdfId: anexoPdf.id,
          datos: valores,
        },
        actor,
      );
      return { ...generado, docx: anexoDocx, pdf: anexoPdf };
    },

    /** HU-037: documentos ya generados para un radicado. */
    async listarGenerados(radicadoId) {
      if (!(await repo.radicado(radicadoId))) throw noEncontrado('El radicado no existe.');
      return repo.listarGenerados(radicadoId);
    },
  };
}

function ErrorAlmacen() {
  return new ErrorApi(503, 'ALMACEN_NO_DISPONIBLE', 'El almacén de archivos no está disponible. Inténtalo de nuevo.');
}
