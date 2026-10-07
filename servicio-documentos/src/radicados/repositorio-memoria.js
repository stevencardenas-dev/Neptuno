import { randomUUID } from 'node:crypto';
import { conflicto, noEncontrado } from '../errores.js';
import { DIGITO_ORIGEN, fechaLocal, formatearCodigo } from './codigo.js';

// Repositorio en memoria con la misma semántica que el de MySQL. Lo usan las pruebas
// y sirve para desarrollar sin base de datos.
export function crearRepositorioMemoria() {
  const radicados = new Map();
  const consecutivos = new Map();
  const eventos = [];

  const registrarEvento = (fabrica, radicado) => {
    eventos.push({ id: randomUUID(), ...fabrica(radicado), ocurridoEn: new Date(), estadoPublicacion: 'PENDIENTE' });
  };
  const copia = (r) => ({ ...r });

  return {
    async insertar(datos, { fecha }, fabricaEvento) {
      const digito = DIGITO_ORIGEN[datos.origen];
      const clave = `${fecha}|${digito}`;
      const consecutivo = (consecutivos.get(clave) ?? 0) + 1;
      consecutivos.set(clave, consecutivo);
      const radicado = {
        entidadId: null, carpetaId: null, comentarios: null, actualizadoPor: null, actualizadoEn: null,
        ...datos,
        id: randomUUID(),
        codigo: formatearCodigo(fecha, digito, consecutivo),
        version: 0,
      };
      radicados.set(radicado.id, radicado);
      registrarEvento(fabricaEvento, radicado);
      return copia(radicado);
    },

    async obtener(id) {
      const r = radicados.get(id);
      return r ? copia(r) : null;
    },

    async buscar(f) {
      const texto = f.q?.toLowerCase();
      const desde = f.desde ? new Date(`${f.desde}T00:00:00-05:00`) : null;
      const hasta = f.hasta ? new Date(new Date(`${f.hasta}T00:00:00-05:00`).getTime() + 86_400_000) : null;
      const todos = [...radicados.values()]
        .filter((r) => !f.codigo || r.codigo.includes(f.codigo))
        .filter((r) => !texto || [r.asunto, r.remitente, r.destinatario].some((c) => c.toLowerCase().includes(texto)))
        .filter((r) => !desde || r.radicadoEn >= desde)
        .filter((r) => !hasta || r.radicadoEn < hasta)
        .filter((r) => !f.origen || r.origen === f.origen)
        .filter((r) => !f.tipoDocumentalId || r.tipoDocumentalId === f.tipoDocumentalId)
        .filter((r) => !f.areaId || r.areaId === f.areaId)
        .filter((r) => !f.estado || r.estado === f.estado)
        .sort((a, b) => b.radicadoEn - a.radicadoEn || b.codigo.localeCompare(a.codigo));
      const inicio = f.pagina * f.tamanio;
      return { contenido: todos.slice(inicio, inicio + f.tamanio).map(copia), total: todos.length, pagina: f.pagina, tamanio: f.tamanio };
    },

    async actualizar(id, version, cambios, fabricaEvento) {
      const actual = radicados.get(id);
      if (!actual) throw noEncontrado('El radicado no existe.');
      if (actual.version !== version) {
        throw conflicto('El radicado fue modificado por otra persona. Recarga los datos e inténtalo de nuevo.');
      }
      const limpio = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
      const nuevo = { ...actual, ...limpio, version: actual.version + 1 };
      radicados.set(id, nuevo);
      registrarEvento(fabricaEvento, nuevo);
      return copia(nuevo);
    },

    async eventosPendientes(limite) {
      return eventos.filter((e) => e.estadoPublicacion === 'PENDIENTE').slice(0, limite);
    },

    async marcarPublicados(ids) {
      for (const e of eventos) if (ids.includes(e.id)) e.estadoPublicacion = 'PUBLICADO';
    },

    // Solo para pruebas.
    _eventos: eventos,
    _hoy: () => fechaLocal(new Date()),
  };
}
