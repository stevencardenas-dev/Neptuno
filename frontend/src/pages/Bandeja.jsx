import { useState } from 'react'
import { Card, KV, Modal, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import { consultarTramite, ejecutarTarea, listarBandeja, tomarTarea } from '../api/workflow.js'
import { formatearFecha, formatearFechaHora } from '../util/formato.js'
import { IconBandeja, IconCheck, IconInfo } from '../components/Icons.jsx'

/**
 * Bandeja de entrada (HU-063…HU-074).
 *
 * El servicio devuelve solo las tareas cuyo paso tiene al usuario como responsable
 * (por usuario, rol o área) y, si administra flujos, también las demás en modo
 * supervisión. Tomar una tarea la reserva; la acción la completa y mueve el trámite.
 */

/** Nombre legible de cada acción del recorrido. */
const ACCIONES = {
  INICIAR: 'Inició el trámite',
  TOMAR: 'Tomó la tarea',
  APROBAR: 'Aprobó',
  ENVIAR: 'Envió al siguiente paso',
  DEVOLVER: 'Devolvió',
  CANCELAR: 'Canceló',
  LIBERAR: 'Liberó la tarea',
}

/** Plazo de la tarea: el semáforo se calcula contra `venceEn` (HU-073, HU-074). */
function plazo(tarea) {
  if (!tarea.venceEn) return { tono: 'gris', texto: 'Sin plazo' }
  if (tarea.vencida) return { tono: 'rojo', texto: `Vencida el ${formatearFecha(tarea.venceEn)}` }
  const horas = (new Date(tarea.venceEn).getTime() - Date.now()) / 3_600_000
  return { tono: horas <= 24 ? 'ambar' : 'verde', texto: `Vence el ${formatearFecha(tarea.venceEn)}` }
}

/** Estado de la tarea tal como lo ve quien la atiende. */
function estadoTarea(tarea) {
  if (tarea.estado === 'PENDIENTE') return { tono: 'gris', texto: 'Pendiente de tomar' }
  return tarea.esMia
    ? { tono: 'azul', texto: 'Tomada por ti' }
    : { tono: 'ambar', texto: 'Tomada por otra persona' }
}

function AtenderTarea({ tarea, onCerrar, onHecho }) {
  const [observacion, setObservacion] = useState('')
  const [enviando, setEnviando] = useState('')
  const [error, setError] = useState(null)
  const detalle = usePeticion(() => consultarTramite(tarea.tramiteId), [tarea.tramiteId])

  const tramite = detalle.datos
  const abierta = tramite?.tareaAbierta
  const acciones = abierta?.acciones ?? tarea.acciones
  const propia = abierta ? abierta.estado === 'PENDIENTE' || abierta.esMia : tarea.estado === 'PENDIENTE' || tarea.esMia
  const exigeMotivo = (accion) => accion === 'DEVOLVER' || accion === 'CANCELAR'
  const motivoListo = observacion.trim().length >= 3

  async function ejecutar(accion) {
    setEnviando(accion)
    setError(null)
    try {
      await ejecutarTarea(tarea.id, { accion, observacion: observacion.trim() || null })
      onHecho()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setEnviando('')
    }
  }

  async function tomar() {
    setEnviando('TOMAR')
    setError(null)
    try {
      await tomarTarea(tarea.id)
      onHecho()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setEnviando('')
    }
  }

  const tonoPlazo = plazo(tarea)
  const estado = estadoTarea(tarea)

  return (
    <Modal
      open
      title="Atender tarea"
      sub={tramite ? `${tramite.radicadoCodigo} · ${tramite.pasoActual.nombre}` : 'Consultando el trámite…'}
      onClose={onCerrar}
      ancho="760px"
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cerrar</button>,
        ...(propia && abierta?.estado === 'PENDIENTE' ? [
          <button key="t" className="btn secondary" type="button" disabled={Boolean(enviando)} onClick={tomar}>
            <IconBandeja size={15} /> {enviando === 'TOMAR' ? 'Tomando…' : 'Tomar la tarea'}
          </button>,
        ] : []),
        ...(propia ? acciones.map((accion) => (
          <button
            key={accion.transicionId}
            className={`btn${accion.accion === 'CANCELAR' ? ' danger' : accion.accion === 'DEVOLVER' ? ' secondary' : ''}`}
            type="button"
            disabled={Boolean(enviando) || (exigeMotivo(accion.accion) && !motivoListo)}
            title={exigeMotivo(accion.accion) && !motivoListo ? 'Escribe el motivo (mínimo 3 caracteres).' : undefined}
            onClick={() => ejecutar(accion.accion)}
          >
            {enviando === accion.accion ? 'Guardando…' : accion.etiqueta}
          </button>
        )) : []),
      ]}
    >
      {detalle.cargando ? <p className="muted small">Consultando el trámite…</p> : null}
      {detalle.error ? <div className="error-message">{detalle.error}</div> : null}

      {tramite ? (
        <div className="stack">
          <div className="row between">
            <span className="code">{tramite.radicadoCodigo}</span>
            <span className={`badge ${tonoPlazo.tono}`}>{tonoPlazo.texto}</span>
          </div>

          <div className="dato">
            <span className="k">Asunto</span>
            <p>{tramite.radicadoAsunto}</p>
          </div>

          <KV items={[
            { k: 'Flujo', v: tramite.flujoNombre },
            { k: 'Paso actual', v: tramite.pasoActual.nombre },
            { k: 'Estado', v: tramite.estado === 'EN_CURSO' ? 'En curso' : tramite.estado === 'FINALIZADO' ? 'Finalizado' : 'Cancelado' },
            { k: 'Iniciado', v: formatearFecha(tramite.iniciadoEn) },
            { k: 'Tarea', v: estado.texto },
          ]} />

          {propia && acciones.length ? (
            <div className="field">
              <label htmlFor="tarea-observacion">Observación</label>
              <textarea
                id="tarea-observacion"
                rows="3"
                maxLength={2000}
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Obligatoria al devolver o cancelar; opcional al aprobar."
              />
              <span className="hint">La observación queda en el recorrido del trámite y en la bitácora.</span>
            </div>
          ) : null}

          {!propia ? (
            <Note icono={<IconInfo size={17} />}>
              Esta tarea la tiene otra persona. Solo quien la tomó, o un administrador de flujos
              en supervisión, puede moverla.
            </Note>
          ) : null}

          {error ? (
            <div className="error-message">
              {error.message}
              {error.detalles?.length ? (
                <div className="detalles">
                  {error.detalles.map((detalleTexto) => <span key={detalleTexto}>· {detalleTexto}</span>)}
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <h4 className="k" style={{ marginBottom: 8 }}>Recorrido del trámite</h4>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Acción</th>
                    <th>Paso</th>
                    <th>Quién</th>
                    <th>Cuándo</th>
                  </tr>
                </thead>
                <tbody>
                  {(tramite.movimientos ?? []).map((movimiento) => (
                    <tr key={movimiento.id}>
                      <td>
                        <strong>{ACCIONES[movimiento.accion] ?? movimiento.accion}</strong>
                        {movimiento.observacion ? <span className="cell-sub">{movimiento.observacion}</span> : null}
                      </td>
                      <td className="muted">
                        {movimiento.origen ? `${movimiento.origen} → ${movimiento.destino}` : movimiento.destino}
                      </td>
                      <td className="muted">{movimiento.usuarioCorreo ?? '—'}</td>
                      <td className="muted">{formatearFechaHora(movimiento.ocurridoEn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(tramite.movimientos ?? []).length ? <div className="empty">Todavía no hay movimientos.</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

export default function Bandeja() {
  const bandeja = usePeticion(listarBandeja, [])
  const [atendiendo, setAtendiendo] = useState(null)

  const tareas = bandeja.datos ?? []
  const sinTomar = tareas.filter((tarea) => tarea.estado === 'PENDIENTE').length

  return (
    <>
      <PageHead
        title="Bandeja de entrada"
        sub="Tareas de los flujos que esperan una decisión tuya: aprobar, enviar al siguiente paso, devolver o cancelar."
        actions={[
          <button key="r" className="btn secondary" type="button" disabled={bandeja.cargando} onClick={bandeja.recargar}>
            Actualizar
          </button>,
        ]}
      />

      <div className="toolbar">
        <span className="badge azul"><IconBandeja size={13} /> {tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'}</span>
        <span className="badge gris">{sinTomar} sin tomar</span>
        <span className="muted small" style={{ marginLeft: 'auto' }}>
          Ordenadas por vencimiento
        </span>
      </div>

      {bandeja.error ? <div className="error-message mt-16">{bandeja.error}</div> : null}

      <Card className="mt-16" tight>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Radicado</th>
                <th>Flujo y paso</th>
                <th>Plazo</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tareas.map((tarea) => {
                const tonoPlazo = plazo(tarea)
                const estado = estadoTarea(tarea)
                return (
                  <tr key={tarea.id} onClick={() => setAtendiendo(tarea)}>
                    <td>
                      <span className="code">{tarea.radicadoCodigo}</span>
                      <span className="cell-sub">{tarea.radicadoAsunto}</span>
                    </td>
                    <td>
                      <strong>{tarea.paso.nombre}</strong>
                      <span className="cell-sub">{tarea.flujoNombre}</span>
                    </td>
                    <td><span className={`badge ${tonoPlazo.tono}`}>{tonoPlazo.texto}</span></td>
                    <td>
                      <span className={`badge ${estado.tono}`}>{estado.texto}</span>
                      {tarea.supervision ? <span className="badge violeta" style={{ marginLeft: 6 }}>Supervisión</span> : null}
                    </td>
                    <td>
                      <div className="td-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn ghost sm" type="button" onClick={() => setAtendiendo(tarea)}>
                          <IconCheck size={15} /> Atender
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!tareas.length ? (
            <div className="empty">
              {bandeja.cargando
                ? 'Cargando la bandeja…'
                : 'No tienes tareas pendientes. Cuando un radicado llegue a un paso del que eres responsable, aparecerá aquí.'}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="mt-16">
        <Note icono={<IconInfo size={17} />}>
          Tomar una tarea la reserva para ti: nadie más puede moverla mientras la tengas. Si tu rol
          administra flujos, verás también las tareas de otros pasos marcadas como supervisión.
        </Note>
      </div>

      {atendiendo ? (
        <AtenderTarea
          tarea={atendiendo}
          onCerrar={() => setAtendiendo(null)}
          onHecho={() => { setAtendiendo(null); bandeja.recargar() }}
        />
      ) : null}
    </>
  )
}
