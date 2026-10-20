import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, KV, Modal, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import { facetasBitacora, listarBitacora, verificarCadena } from '../api/auditoria.js'
import { useSesion } from '../sesion/SesionProvider.jsx'
import { formatearFecha, formatearFechaHora } from '../util/formato.js'
import { IconCheck, IconEscudo, IconFiltro, IconOjo } from '../components/Icons.jsx'

const TAMANIO = 15

/** Nombre legible de las acciones que hoy publican los servicios. Un tipo que no esté
 *  en el mapa se muestra con su propio código: inventarle un nombre a un hecho nuevo
 *  sería peor que enseñar el código con el que viaja. */
const ACCIONES = {
  'sesion.iniciada': 'Inicio de sesión',
  'sesion.cerrada': 'Cierre de sesión',
  'usuario.creado': 'Usuario creado',
  'usuario.editado': 'Usuario editado',
  'usuario.eliminado': 'Usuario eliminado',
  'usuario.clave-actualizada': 'Contraseña actualizada',
  'usuario.roles-asignados': 'Roles del usuario actualizados',
  'rol.creado': 'Rol creado',
  'rol.editado': 'Rol editado',
  'rol.eliminado': 'Rol eliminado',
  'rol.permisos-asignados': 'Permisos del rol actualizados',
  'radicado.creado': 'Radicado creado',
  'radicado.editado': 'Radicado editado',
  'flujo.creado': 'Flujo creado',
  'flujo.editado': 'Flujo editado',
  'flujo.paso-agregado': 'Paso agregado',
  'flujo.paso-editado': 'Paso editado',
  'flujo.paso-marcado': 'Paso marcado como inicial o final',
  'flujo.paso-retirado': 'Paso retirado',
  'flujo.transicion-agregada': 'Transición agregada',
  'flujo.transicion-editada': 'Transición editada',
  'flujo.transicion-retirada': 'Transición retirada',
  'flujo.responsable-asignado': 'Responsable asignado',
  'flujo.responsable-retirado': 'Responsable retirado',
  'flujo.publicado': 'Flujo publicado',
  'flujo.desactivado': 'Flujo archivado',
  'flujo.reactivado': 'Flujo reactivado',
  'catalogo.area-creada': 'Área creada',
  'catalogo.area-editada': 'Área editada',
  'catalogo.area-desactivada': 'Área desactivada',
  'catalogo.entidad-creada': 'Entidad creada',
  'catalogo.entidad-editada': 'Entidad editada',
  'catalogo.entidad-desactivada': 'Entidad desactivada',
  'catalogo.tipo-documental-creado': 'Tipo documental creado',
  'catalogo.tipo-documental-editado': 'Tipo documental editado',
  'catalogo.tipo-documental-desactivado': 'Tipo documental desactivado',
}

/** Nombre legible del servicio que reportó el hecho. */
const SERVICIOS = {
  'servicio-usuarios': 'Usuarios y seguridad',
  'servicio-documentos': 'Gestión documental',
  'servicio-workflow': 'Flujo de trabajo',
  'servicio-auditoria': 'Bitácora',
}

function etiquetaAccion(tipo) {
  return ACCIONES[tipo] ?? tipo
}

function etiquetaServicio(servicio) {
  return SERVICIOS[servicio] ?? servicio
}

/**
 * El detalle se guarda como JSON para que quepa cualquier hecho; en pantalla se muestra
 * su contenido y no el JSON. Un detalle que no sea JSON válido se enseña tal cual.
 */
function textoDelDetalle(detalle) {
  if (!detalle) return ''
  try {
    const valor = JSON.parse(detalle)
    return typeof valor === 'string' ? valor : JSON.stringify(valor, null, 2)
  } catch {
    return detalle
  }
}

/** HU-044: el estado de la cadena, que es la razón de ser de toda la bitácora. */
function EstadoCadena({ cadena }) {
  const dato = cadena.datos
  const rota = Boolean(dato && !dato.integra)
  const tono = cadena.error || !dato ? 'gris' : (rota ? 'rojo' : 'verde')
  const sello = cadena.error
    ? { clase: 'ambar', texto: 'Sin comprobar' }
    : !dato
      ? { clase: 'gris', texto: 'Comprobando' }
      : rota
        ? { clase: 'rojo', texto: 'Rota' }
        : { clase: 'verde', texto: 'Íntegra' }

  const titulo = cadena.error
    ? 'No se pudo comprobar la cadena'
    : !dato
      ? 'Revisando los registros uno por uno…'
      : rota
        ? `La cadena se rompió en el registro ${dato.primerCorte?.secuencia ?? '?'}`
        : 'Ningún registro se ha alterado'

  const nota = cadena.error
    ? cadena.error
    : rota
      ? (dato.primerCorte?.motivo ?? 'Un registro no cuadra con su huella.')
      : ''

  return (
    <Card className={`mt-16 cadena cadena-${tono}`} tight>
      <div className="cadena-fila">
        <span className={`badge ${sello.clase}`}>
          {dato && !rota && !cadena.error ? <IconCheck size={13} /> : null}
          {sello.texto}
        </span>
        <div className="cadena-texto">
          <strong>{titulo}</strong>
          {nota ? <span className="cadena-nota">{nota}</span> : null}
        </div>
        {dato && !rota && !cadena.error ? (
          <dl className="cadena-datos">
            <div>
              <dt>Registros verificados</dt>
              <dd>{dato.registros}</dd>
            </div>
            <div>
              <dt>Última comprobación</dt>
              <dd>{formatearFechaHora(dato.comprobadoEn)}</dd>
            </div>
          </dl>
        ) : null}
        <button className="btn secondary sm" type="button" disabled={cadena.cargando} onClick={cadena.recargar}>
          {cadena.cargando ? 'Comprobando…' : 'Comprobar de nuevo'}
        </button>
      </div>
    </Card>
  )
}

/** Detalle de un registro: lo que pasó, quién lo hizo y su lugar en la cadena. */
function DetalleRegistro({ registro, onCerrar }) {
  return (
    <Modal
      open
      title="Registro de bitácora"
      sub={`N.º ${registro.secuencia} · ${formatearFecha(registro.ocurridoEn)}`}
      onClose={onCerrar}
      ancho="700px"
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cerrar</button>,
      ]}
    >
      <div className="stack">
        <div className="row between">
          <strong>{etiquetaAccion(registro.tipoEvento)}</strong>
          <span className="badge blanco">{etiquetaServicio(registro.servicioOrigen)}</span>
        </div>

        <KV items={[
          { k: 'Código de la acción', v: registro.tipoEvento },
          { k: 'Entidad afectada', v: registro.entidad },
          { k: 'Identificador', v: registro.entidadId ?? '—' },
          ...(registro.radicadoId ? [{ k: 'Radicado', v: registro.radicadoId }] : []),
          { k: 'Actor', v: registro.actorCorreo ?? 'El sistema' },
          ...(registro.estadoAnterior || registro.estadoNuevo
            ? [{ k: 'Cambio de estado', v: `${registro.estadoAnterior ?? '—'} → ${registro.estadoNuevo ?? '—'}` }]
            : []),
          { k: 'Ocurrió', v: formatearFecha(registro.ocurridoEn) },
          { k: 'Se encadenó', v: formatearFecha(registro.recibidoEn) },
        ]} />

        {textoDelDetalle(registro.detalle) ? (
          <div className="dato">
            <span className="k">Detalle</span>
            <p>{textoDelDetalle(registro.detalle)}</p>
          </div>
        ) : null}

        {registro.observacion ? (
          <div className="dato">
            <span className="k">Observación</span>
            <p>{registro.observacion}</p>
          </div>
        ) : null}

        <div className="dato">
          <span className="k">Huella de este registro</span>
          <span className="hash">{registro.hash}</span>
        </div>
        <div className="dato">
          <span className="k">Huella del registro anterior</span>
          <span className="hash">{registro.hashAnterior ?? 'Es el primer registro de la cadena.'}</span>
        </div>
      </div>
    </Modal>
  )
}

export default function Bitacora() {
  const { puede } = useSesion()
  const [parametros, setParametros] = useSearchParams()
  const [pagina, setPagina] = useState(0)
  const [fServicio, setFServicio] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fEntidad, setFEntidad] = useState('')
  const [fActor, setFActor] = useState('')
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')
  const [fRadicado, setFRadicado] = useState(parametros.get('radicado') ?? '')
  const [detalle, setDetalle] = useState(null)

  const bitacora = usePeticion(() => listarBitacora({
    servicio: fServicio, tipo: fTipo, entidad: fEntidad, actor: fActor,
    desde: fDesde, hasta: fHasta, radicadoId: fRadicado, pagina, tamanio: TAMANIO,
  }), [fServicio, fTipo, fEntidad, fActor, fDesde, fHasta, fRadicado, pagina])

  // Los valores de los filtros se piden al servicio para elegir de una lista real en vez
  // de escribir el valor exacto, que es como se compara.
  const facetas = usePeticion(() => facetasBitacora(), [])
  const cadena = usePeticion(() => verificarCadena(), [])

  const lista = bitacora.datos?.contenido ?? []
  const total = bitacora.datos?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANIO))
  const puedeFiltrar = puede('bitacora:filtrar')
  const valores = facetas.datos ?? { servicios: [], tipos: [], entidades: [], actores: [] }

  function filtrar(accion) {
    accion()
    setPagina(0)
  }

  function verTodo() {
    setFRadicado('')
    setParametros({}, { replace: true })
    setPagina(0)
  }

  return (
    <>
      <PageHead
        title="Bitácora"
        sub="Historial de lo que ocurre en el sistema. Cada hecho se encadena con el anterior por su huella, así que no se puede modificar ni borrar sin que se note."
      />

      <EstadoCadena cadena={cadena} />

      <div className="toolbar mt-16">
        <label className="field" style={{ minWidth: 175 }}>
          <span className="k">Servicio</span>
          <select
            value={fServicio}
            disabled={!puedeFiltrar}
            onChange={(e) => filtrar(() => setFServicio(e.target.value))}
          >
            <option value="">Todos</option>
            {valores.servicios.map((valor) => (
              <option key={valor} value={valor}>{etiquetaServicio(valor)}</option>
            ))}
          </select>
        </label>

        <label className="field" style={{ minWidth: 190 }}>
          <span className="k">Acción</span>
          <select
            value={fTipo}
            disabled={!puedeFiltrar}
            onChange={(e) => filtrar(() => setFTipo(e.target.value))}
          >
            <option value="">Todas</option>
            {valores.tipos.map((valor) => (
              <option key={valor} value={valor}>{etiquetaAccion(valor)}</option>
            ))}
          </select>
        </label>

        <label className="field" style={{ minWidth: 140 }}>
          <span className="k">Entidad</span>
          <select
            value={fEntidad}
            disabled={!puedeFiltrar}
            onChange={(e) => filtrar(() => setFEntidad(e.target.value))}
          >
            <option value="">Todas</option>
            {valores.entidades.map((valor) => <option key={valor} value={valor}>{valor}</option>)}
          </select>
        </label>

        <label className="field" style={{ minWidth: 190 }}>
          <span className="k">Actor</span>
          <select
            value={fActor}
            disabled={!puedeFiltrar}
            onChange={(e) => filtrar(() => setFActor(e.target.value))}
          >
            <option value="">Cualquiera</option>
            {valores.actores.map((valor) => <option key={valor} value={valor}>{valor}</option>)}
          </select>
        </label>

        <label className="field" style={{ minWidth: 150 }}>
          <span className="k">Desde</span>
          <input
            type="date"
            value={fDesde}
            max={fHasta || undefined}
            disabled={!puedeFiltrar}
            onChange={(e) => filtrar(() => setFDesde(e.target.value))}
          />
        </label>

        <label className="field" style={{ minWidth: 150 }}>
          <span className="k">Hasta</span>
          <input
            type="date"
            value={fHasta}
            min={fDesde || undefined}
            disabled={!puedeFiltrar}
            onChange={(e) => filtrar(() => setFHasta(e.target.value))}
          />
        </label>

        <span className="badge azul" style={{ marginLeft: 'auto' }}>
          <IconFiltro size={13} /> {lista.length} de {total}
        </span>
      </div>

      {!puedeFiltrar ? (
        <p className="hint">
          Tu rol puede consultar la bitácora, pero no acotarla por usuario, fecha ni acción.
        </p>
      ) : null}

      {fRadicado ? (
        <div className="row between mt-16">
          <span className="muted small">Mostrando solo los hechos del documento seleccionado.</span>
          <button className="btn secondary sm" type="button" onClick={verTodo}>
            Ver toda la bitácora
          </button>
        </div>
      ) : null}

      <Card className="mt-16" tight>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 64 }}>N.º</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Actor</th>
                <th>Servicio</th>
                <th>Fecha y hora</th>
                <th style={{ textAlign: 'right' }}>Ver</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((registro) => (
                <tr key={registro.secuencia} onClick={() => setDetalle(registro)}>
                  <td className="muted">{registro.secuencia}</td>
                  <td>
                    <strong>{etiquetaAccion(registro.tipoEvento)}</strong>
                    <span className="cell-sub">{registro.tipoEvento}</span>
                  </td>
                  <td>{registro.entidad}</td>
                  <td>{registro.actorCorreo ?? 'El sistema'}</td>
                  <td><span className="badge blanco">{etiquetaServicio(registro.servicioOrigen)}</span></td>
                  <td className="muted">{formatearFecha(registro.ocurridoEn)}</td>
                  <td>
                    <div className="td-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn ghost sm"
                        type="button"
                        title="Ver el registro completo"
                        onClick={() => setDetalle(registro)}
                      >
                        <IconOjo size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!lista.length ? (
            <div className="empty">
              {bitacora.cargando ? 'Cargando la bitácora…' : bitacora.error || 'Ningún hecho coincide con los filtros.'}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="row between mt-16">
        <span className="muted small">
          Página {pagina + 1} de {totalPaginas} · {total} {total === 1 ? 'registro' : 'registros'}
        </span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary sm" type="button" disabled={pagina === 0} onClick={() => setPagina((p) => Math.max(0, p - 1))}>Anterior</button>
          <button className="btn secondary sm" type="button" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
        </div>
      </div>

      <div className="mt-16">
        <Note icono={<IconEscudo size={17} />}>
          Cada registro guarda la huella del anterior, así que la bitácora entera se puede
          comprobar de una sola pasada: si alguien cambiara un dato o borrara una línea, la
          comprobación lo señalaría en el registro exacto. La base rechaza además cualquier
          intento de modificar o eliminar un registro ya escrito.
        </Note>
      </div>

      {detalle ? <DetalleRegistro registro={detalle} onCerrar={() => setDetalle(null)} /> : null}
    </>
  )
}
