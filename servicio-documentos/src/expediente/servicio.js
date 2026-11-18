import { noEncontrado, prohibido, reglaInvalida } from '../errores.js';
import { alcanza, esquemaAccesos, esquemaCarpeta, esquemaCarpetaEditar, esquemaDocumento, mayorNivel, validar } from './modelo.js';

/**
 * Expediente central (HU-030…HU-034): árbol de carpetas por área, subcarpetas,
 * visibilidad por rol o área y documentos No radicables.
 *
 * El área dueña administra su árbol; un acceso concedido en una carpeta se hereda a
 * todo su subárbol. Quien tiene `expediente:administrar` ve y administra todas.
 */
export function crearServicioExpediente({ repo, catalogos }) {
  const administraTodo = (actor) => actor.permisos.has('expediente:administrar');

  async function nivelDe(actor, carpetaId) {
    if (administraTodo(actor)) return { carpeta: await repo.carpeta(carpetaId), nivel: 'ADMINISTRAR' };
    const carpeta = await repo.carpeta(carpetaId);
    if (!carpeta) return { carpeta: null, nivel: null };
    return { carpeta, nivel: await repo.nivelAcceso(actor, carpetaId) };
  }

  async function exigirNivel(actor, carpetaId, nivel) {
    const { carpeta, nivel: tiene } = await nivelDe(actor, carpetaId);
    if (!carpeta || carpeta.estado !== 'ACTIVO') throw noEncontrado('La carpeta no existe.');
    if (!alcanza(tiene, nivel)) {
      throw prohibido(nivel === 'VER'
        ? 'No tienes acceso a esta carpeta del expediente.'
        : 'No tienes permiso para cargar o administrar en esta carpeta.');
    }
    return carpeta;
  }

  return {
    /** HU-032, HU-033: el árbol que puede ver el actor, con sus documentos y radicados. */
    async arbol(actor) {
      const [carpetas, accesos, documentos, radicados] = await Promise.all([
        repo.listarCarpetas(),
        repo.listarAccesos(),
        repo.listarDocumentos(),
        repo.radicadosEnCarpetas(),
      ]);
      const porCarpeta = new Map();
      for (const acceso of accesos) {
        if (!porCarpeta.has(acceso.carpetaId)) porCarpeta.set(acceso.carpetaId, []);
        porCarpeta.get(acceso.carpetaId).push(acceso);
      }
      const indice = new Map(carpetas.map((carpeta) => [carpeta.id, carpeta]));
      const orden = { VER: 1, CARGAR: 2, ADMINISTRAR: 3 };

      const nivelEn = (carpeta) => {
        if (administraTodo(actor)) return 'ADMINISTRAR';
        let actual = carpeta;
        const niveles = [];
        while (actual) {
          if (actual.areaId === actor.areaId) niveles.push('ADMINISTRAR');
          for (const acceso of porCarpeta.get(actual.id) ?? []) {
            const suyo = acceso.tipoSujeto === 'AREA'
              ? acceso.sujetoId === actor.areaId
              : (actor.rolesIds ?? []).includes(acceso.sujetoId);
            if (suyo) niveles.push(acceso.nivel);
          }
          actual = actual.padreId ? indice.get(actual.padreId) : null;
        }
        return mayorNivel(niveles);
      };

      const nodos = new Map();
      for (const carpeta of carpetas) {
        const nivel = nivelEn(carpeta);
        if (!nivel) continue;
        nodos.set(carpeta.id, {
          id: carpeta.id,
          areaId: carpeta.areaId,
          padreId: carpeta.padreId,
          nombre: carpeta.nombre,
          tipoExpediente: carpeta.tipoExpediente,
          ruta: carpeta.ruta,
          nivel,
          carpetas: [],
          documentos: [],
          radicados: [],
        });
      }
      const raices = [];
      for (const nodo of nodos.values()) {
        const padre = nodo.padreId ? nodos.get(nodo.padreId) : null;
        if (padre) padre.carpetas.push(nodo);
        else raices.push(nodo);
      }
      for (const documento of documentos) {
        nodos.get(documento.carpetaId)?.documentos.push(documento);
      }
      for (const radicado of radicados) {
        nodos.get(radicado.carpetaId)?.radicados.push(radicado);
      }
      const ordenar = (lista) => {
        lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
        lista.forEach((nodo) => ordenar(nodo.carpetas));
      };
      ordenar(raices);
      return raices;
    },

    /** HU-030, HU-031: crear la carpeta raíz de un área o una subcarpeta. */
    async crearCarpeta(actor, cuerpo) {
      const datos = validar(esquemaCarpeta, cuerpo);
      if (!administraTodo(actor)) {
        throw prohibido('Requiere el permiso expediente:administrar para crear carpetas.');
      }
      let areaId = datos.areaId ?? actor.areaId;
      let padre = null;
      let ruta;
      if (datos.padreId) {
        padre = await repo.carpeta(datos.padreId);
        if (!padre || padre.estado !== 'ACTIVO') throw noEncontrado('La carpeta padre no existe.');
        areaId = padre.areaId;
        ruta = `${padre.ruta}/${datos.nombre}`;
      } else {
        const existente = (await repo.listarCarpetas()).find((carpeta) => !carpeta.padreId && carpeta.areaId === areaId);
        if (existente) throw reglaInvalida(`El área ya tiene su carpeta raíz: «${existente.nombre}».`);
        ruta = `/${datos.nombre}`;
      }
      return repo.crearCarpeta(
        {
          areaId,
          padreId: padre?.id ?? null,
          nombre: datos.nombre,
          tipoExpediente: datos.tipoExpediente,
          ruta,
        },
        actor,
      );
    },

    /** HU-031: renombrar o cambiar el tipo de expediente de una carpeta. */
    async editarCarpeta(actor, carpetaId, cuerpo) {
      if (!administraTodo(actor)) throw prohibido('Requiere el permiso expediente:administrar para editar carpetas.');
      const carpeta = await repo.carpeta(carpetaId);
      if (!carpeta) throw noEncontrado('La carpeta no existe.');
      const cambios = validar(esquemaCarpetaEditar, cuerpo);
      return repo.editarCarpeta(carpeta, cambios, actor);
    },

    /** HU-030: una carpeta solo se desactiva cuando está vacía. */
    async desactivarCarpeta(actor, carpetaId) {
      if (!administraTodo(actor)) throw prohibido('Requiere el permiso expediente:administrar para desactivar carpetas.');
      const carpeta = await repo.carpeta(carpetaId);
      if (!carpeta) throw noEncontrado('La carpeta no existe.');
      const contenido = await repo.contenidoDeCarpeta(carpetaId);
      if (contenido.hijas || contenido.documentos || contenido.radicados) {
        throw reglaInvalida(
          'La carpeta todavía tiene contenido: muévelo o desactívalo antes de desactivarla.',
          [
            contenido.hijas ? `${contenido.hijas} subcarpeta(s)` : null,
            contenido.documentos ? `${contenido.documentos} documento(s)` : null,
            contenido.radicados ? `${contenido.radicados} radicado(s)` : null,
          ].filter(Boolean),
        );
      }
      return repo.desactivarCarpeta(carpeta, actor);
    },

    /** HU-033: accesos concedidos en la carpeta (se heredan a las subcarpetas). */
    async listarAccesos(actor, carpetaId) {
      await exigirNivel(actor, carpetaId, 'ADMINISTRAR');
      return repo.accesosDe(carpetaId);
    },

    /** HU-033: reemplaza los accesos por rol o por área, validándolos en el catálogo. */
    async reemplazarAccesos(actor, carpetaId, cuerpo) {
      const { accesos } = validar(esquemaAccesos, cuerpo);
      const carpeta = await exigirNivel(actor, carpetaId, 'ADMINISTRAR');
      const vistos = new Set();
      for (const acceso of accesos) {
        const clave = `${acceso.tipoSujeto}|${acceso.sujetoId}`;
        if (vistos.has(clave)) throw reglaInvalida('No repitas el mismo rol o área en los accesos de la carpeta.');
        vistos.add(clave);
        const sujeto = acceso.tipoSujeto === 'ROL'
          ? await catalogos.rol(acceso.sujetoId, actor.token)
          : await catalogos.area(acceso.sujetoId, actor.token);
        if (!sujeto) throw reglaInvalida(acceso.tipoSujeto === 'ROL' ? 'Ese rol no existe.' : 'Esa área no existe.');
      }
      return repo.reemplazarAccesos(carpeta, accesos, actor);
    },

    /** HU-034: documento No radicable cargado directo a la carpeta. */
    async crearDocumento(actor, carpetaId, cuerpo) {
      const datos = validar(esquemaDocumento, cuerpo);
      const carpeta = await exigirNivel(actor, carpetaId, 'CARGAR');
      return repo.crearDocumento(carpeta, datos, actor);
    },

    async listarDocumentos(actor, carpetaId) {
      await exigirNivel(actor, carpetaId, 'VER');
      return repo.listarDocumentosDeCarpeta(carpetaId);
    },

    async obtenerDocumento(actor, documentoId) {
      const documento = await repo.documento(documentoId);
      if (!documento) throw noEncontrado('El documento del expediente no existe.');
      await exigirNivel(actor, documento.carpetaId, 'VER');
      return documento;
    },

    /** Un documento solo se adjunta si quien lo hace puede cargar en su carpeta. */
    async exigirDocumentoParaAnexos(actor, documentoId) {
      const documento = await repo.documento(documentoId);
      if (!documento) throw noEncontrado('El documento del expediente no existe.');
      await exigirNivel(actor, documento.carpetaId, 'CARGAR');
      return documento;
    },

    /** Usado al archivar un radicado: hay que poder cargar en la carpeta destino. */
    async exigirCarpetaParaRadicar(actor, carpetaId) {
      return exigirNivel(actor, carpetaId, 'CARGAR');
    },
  };
}
