import { useState } from 'react'
import { Card, KV, Modal, Note, PageHead, Stat } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import {
  capturarRendimiento,
  ejecutarRespaldo,
  ejecutarRestauracion,
  guardarProgramacionDeRespaldos,
  listarCapturasDeRendimiento,
  listarPruebasDeCarga,
  listarRespaldos,
  listarRestauraciones,
  programacionDeRespaldos,
  resumenRendimiento,
  solicitarRestauracion,
} from '../api/auditoria.js'
import { formatearFecha, formatearFechaHora } from '../util/formato.js'
import { tamanoLegible } from '../util/archivos.js'
import { IconEscudo, IconInfo } from '../components/Icons.jsx'

/**
 * Operación del sistema: copias de seguridad (HU-081), restauración (HU-082),
 * rendimiento (HU-084) y pruebas de carga (HU-085).
 *
 * Restaurar sobrescribe datos, así que se pide con un motivo y la confirma otra persona:
 * el servicio rechaza que quien solicitó sea quien ejecute.
 */

const FRECUENCIAS = [
  { valor: 'DIARIA', etiqueta: 'Diaria' },
  { valor: 'CADA_12_HORAS', etiqueta: 'Cada 12 horas' },
  { valor: 'SEMANAL', etiqueta: 'Semanal' },
]

const TONO_RESPALDO = {
  EN_CURSO: 'ambar',
  COMPLETADO: 'verde',
  FALLIDO: 'rojo',
  EXPIRADO: 'gris',
}

const TONO_RESTAURACION = {
  SOLICITADA: 'ambar',
  EN_CURSO: 'azul',
  COMPLETADA: 'verde',
  FALLIDA: 'rojo',
  CANCELADA: 'gris',
}

function ModalRestauracion({ respaldo, onCerrar, onHecho }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function solicitar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await solicitarRestauracion(respaldo.id, motivo.trim())
      onHecho()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      title="Solicitar restauración"
      sub={`Respaldo del ${formatearFecha(respaldo.iniciadoEn)}`}
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn danger" type="submit" form="form-restauracion" disabled={guardando || motivo.trim().length < 10}>
          {guardando ? 'Solicitando…' : 'Solicitar restauración'}
        </button>,
      ]}
    >
      <form id="form-restauracion" className="stack" onSubmit={solicitar}>
        <Note tono="rojo" icono={<IconEscudo size={17} />}>
          Restaurar reemplaza el contenido de las bases incluidas en el respaldo. Otra
          persona debe confirmarla; queda registrado quién la pidió y quién la ejecutó.
        </Note>
        <div className="field">
          <label htmlFor="restauracion-motivo">Motivo <span className="req">*</span></label>
          <textarea id="restauracion-motivo" rows="3" maxLength={500} value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Se borraron registros por error durante la migración del 12 de marzo" />
          <span className="hint">Mínimo 10 caracteres.</span>
        </div>
        {error ? <div className="error-message">{error.message}</div> : null}
      </form>
    </Modal>
  )
}

function Programacion() {
  const consulta = usePeticion(programacionDeRespaldos, [])
  const [cambios, setCambios] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)

  const actual = consulta.datos
  const datos = cambios ?? actual

  function editar(campo, valor) {
    setCambios({ ...(datos ?? {}), [campo]: valor })
  }

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    setAviso('')
    try {
      const guardada = await guardarProgramacionDeRespaldos({
        frecuencia: datos.frecuencia,
        hora: datos.hora,
        retencionDias: Number(datos.retencionDias),
        incluyeDocumentos: Boolean(datos.incluyeDocumentos),
        incluyeBitacora: Boolean(datos.incluyeBitacora),
        activa: Boolean(datos.activa),
      })
      setCambios(null)
      setAviso(`Programación guardada: ${guardada.frecuencia === 'SEMANAL' ? 'semanal' : guardada.frecuencia === 'CADA_12_HORAS' ? 'cada 12 horas' : 'diaria'} a las ${guardada.hora}.`)
      consulta.recargar()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  if (consulta.cargando) return <p className="muted small">Consultando la programación…</p>
  if (consulta.error) return <div className="error-message">{consulta.error}</div>

  return (
    <form className="stack" onSubmit={guardar}>
      <div className="field-row">
        <div className="field">
          <label htmlFor="respaldo-frecuencia">Frecuencia</label>
          <select id="respaldo-frecuencia" value={datos.frecuencia} onChange={(e) => editar('frecuencia', e.target.value)}>
            {FRECUENCIAS.map((frecuencia) => (
              <option key={frecuencia.valor} value={frecuencia.valor}>{frecuencia.etiqueta}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="respaldo-hora">Hora (UTC)</label>
          <input id="respaldo-hora" type="text" pattern="[0-2][0-9]:[0-5][0-9]" value={datos.hora}
            onChange={(e) => editar('hora', e.target.value)} placeholder="02:00" />
        </div>
        <div className="field">
          <label htmlFor="respaldo-retencion">Retención (días)</label>
          <input id="respaldo-retencion" type="number" min="1" max="3650" value={datos.retencionDias}
            onChange={(e) => editar('retencionDias', e.target.value)} />
        </div>
      </div>

      <div className="opciones">
        <label className="check">
          <input type="checkbox" checked={Boolean(datos.activa)} onChange={(e) => editar('activa', e.target.checked)} />
          <span>Copia activa</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={Boolean(datos.incluyeBitacora)} onChange={(e) => editar('incluyeBitacora', e.target.checked)} />
          <span>Incluir la bitácora</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={Boolean(datos.incluyeDocumentos)} onChange={(e) => editar('incluyeDocumentos', e.target.checked)} />
          <span>Incluir documentos</span>
        </label>
      </div>

      <span className="hint">
        Las copias se guardan en el volumen de respaldos del servicio de auditoría. Los
        objetos de MinIO se respaldan con la herramienta del almacenamiento: esta copia cubre
        las bases de datos.
      </span>

      {error ? <div className="error-message">{error.message}</div> : null}
      {aviso ? <div className="aviso-ok">{aviso}</div> : null}

      <div className="row">
        <button className="btn" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar programación'}
        </button>
      </div>
    </form>
  )
}

function Respaldos({ onRestaurar, onCambio }) {
  const lista = usePeticion(() => listarRespaldos(25), [])
  const [ejecutando, setEjecutando] = useState(false)
  const [error, setError] = useState(null)

  const respaldos = lista.datos?.contenido ?? []

  async function respaldar() {
    setEjecutando(true)
    setError(null)
    try {
      await ejecutarRespaldo()
      lista.recargar()
      onCambio()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setEjecutando(false)
    }
  }

  return (
    <div className="stack">
      <div className="row between">
        <span className="muted small">{respaldos.length} ejecuciones registradas</span>
        <button className="btn secondary sm" type="button" disabled={ejecutando} onClick={respaldar}>
          {ejecutando ? 'Copiando…' : 'Respaldar ahora'}
        </button>
      </div>

      {error ? <div className="error-message">{error.message}</div> : null}
      {lista.error ? <div className="error-message">{lista.error}</div> : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Inicio</th><th>Estado</th><th>Bases</th><th>Tamaño</th><th style={{ textAlign: 'right' }}>Acciones</th></tr>
          </thead>
          <tbody>
            {respaldos.map((respaldo) => (
              <tr key={respaldo.id}>
                <td>
                  {formatearFecha(respaldo.iniciadoEn)}
                  <span className="cell-sub">
                    {respaldo.programacionId ? 'Programada' : 'Manual'}
                    {respaldo.finalizadoEn ? ` · terminó ${formatearFechaHora(respaldo.finalizadoEn)}` : ''}
                  </span>
                </td>
                <td>
                  <span className={`badge ${TONO_RESPALDO[respaldo.estado] ?? 'gris'}`}>{respaldo.estado}</span>
                  {respaldo.mensajeError ? <span className="cell-sub">{respaldo.mensajeError}</span> : null}
                </td>
                <td className="muted">{(respaldo.basesIncluidas ?? []).join(', ') || '—'}</td>
                <td className="muted">{respaldo.tamanoBytes ? tamanoLegible(respaldo.tamanoBytes) : '—'}</td>
                <td>
                  <div className="td-actions">
                    {respaldo.estado === 'COMPLETADO' ? (
                      <button className="btn ghost sm" type="button" onClick={() => onRestaurar(respaldo)}>
                        Restaurar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!respaldos.length ? <div className="empty">Todavía no se ha ejecutado ninguna copia.</div> : null}
      </div>
    </div>
  )
}

function Restauraciones({ version, onCambio }) {
  const lista = usePeticion(() => listarRestauraciones(25), [version])
  const [ejecutando, setEjecutando] = useState('')
  const [error, setError] = useState(null)
  const restauraciones = lista.datos?.contenido ?? []

  async function confirmar(restauracion) {
    setEjecutando(restauracion.id)
    setError(null)
    try {
      await ejecutarRestauracion(restauracion.id)
      lista.recargar()
      onCambio()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setEjecutando('')
    }
  }

  return (
    <div className="stack">
      {error ? <div className="error-message">{error.message}</div> : null}
      {lista.error ? <div className="error-message">{lista.error}</div> : null}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Solicitada</th><th>Motivo</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr>
          </thead>
          <tbody>
            {restauraciones.map((restauracion) => (
              <tr key={restauracion.id}>
                <td>
                  {formatearFechaHora(restauracion.solicitadaEn)}
                  <span className="cell-sub">Respaldo {restauracion.respaldoId.slice(0, 8)}</span>
                </td>
                <td>
                  {restauracion.motivo}
                  {restauracion.resultado ? <span className="cell-sub">{restauracion.resultado}</span> : null}
                </td>
                <td><span className={`badge ${TONO_RESTAURACION[restauracion.estado] ?? 'gris'}`}>{restauracion.estado}</span></td>
                <td>
                  <div className="td-actions">
                    {restauracion.estado === 'SOLICITADA' ? (
                      <button className="btn ghost sm" type="button" disabled={ejecutando === restauracion.id}
                        onClick={() => confirmar(restauracion)}>
                        {ejecutando === restauracion.id ? 'Restaurando…' : 'Confirmar y ejecutar'}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!restauraciones.length ? <div className="empty">No hay restauraciones solicitadas.</div> : null}
      </div>
      <span className="hint">Quien solicita una restauración no puede confirmarla: hace falta otra persona.</span>
    </div>
  )
}

function Rendimiento() {
  const vivo = usePeticion(resumenRendimiento, [])
  const capturas = usePeticion(() => listarCapturasDeRendimiento(20), [])
  const pruebas = usePeticion(() => listarPruebasDeCarga(20), [])
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const mediciones = vivo.datos?.contenido ?? []
  const peor = mediciones.reduce((maximo, medicion) => Math.max(maximo, medicion.p95Ms), 0)

  async function capturar() {
    setGuardando(true)
    setError(null)
    try {
      await capturarRendimiento()
      capturas.recargar()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="stack">
      <div className="grid grid-metricas">
        <Stat label="Límite por solicitud" valor="2 s" nota="p95 aceptado" />
        <Stat label="Rutas medidas" valor={mediciones.length} />
        <Stat label="Peor p95" valor={mediciones.length ? `${peor} ms` : '—'} tono={peor > 2000 ? 'rojo' : 'verde'} />
        <Stat label="¿Cumple?" valor={vivo.datos?.cumpleTodo === false ? 'No' : 'Sí'} tono={vivo.datos?.cumpleTodo === false ? 'rojo' : 'verde'} />
      </div>

      <div className="row between">
        <span className="muted small">Medición desde el arranque del servicio de auditoría</span>
        <div className="row">
          <button className="btn ghost sm" type="button" onClick={() => { vivo.recargar(); pruebas.recargar(); capturas.recargar() }}>
            Actualizar
          </button>
          <button className="btn secondary sm" type="button" disabled={guardando} onClick={capturar}>
            {guardando ? 'Guardando…' : 'Guardar captura'}
          </button>
        </div>
      </div>

      {error ? <div className="error-message">{error.message}</div> : null}
      {vivo.error ? <div className="error-message">{vivo.error}</div> : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Ruta</th><th>Solicitudes</th><th>p50</th><th>p95</th><th>p99</th><th>¿Cumple?</th></tr>
          </thead>
          <tbody>
            {mediciones.map((medicion) => (
              <tr key={`${medicion.metodo} ${medicion.ruta}`}>
                <td><span className="code">{medicion.metodo}</span> {medicion.ruta}</td>
                <td className="muted">{medicion.solicitudes}</td>
                <td className="muted">{medicion.p50Ms} ms</td>
                <td><strong>{medicion.p95Ms} ms</strong></td>
                <td className="muted">{medicion.p99Ms} ms</td>
                <td><span className={`badge ${medicion.cumple ? 'verde' : 'rojo'}`}>{medicion.cumple ? 'Sí' : 'No'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!mediciones.length ? <div className="empty">Todavía no se ha medido ninguna solicitud en este proceso.</div> : null}
      </div>

      <div>
        <h4 className="k" style={{ marginBottom: 8 }}>Pruebas de carga</h4>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Escenario</th><th>Usuarios</th><th>Solicitudes</th><th>p95 / p99</th><th>¿Cumple?</th><th>Ejecutada</th></tr>
            </thead>
            <tbody>
              {(pruebas.datos?.contenido ?? []).map((prueba) => (
                <tr key={prueba.id}>
                  <td>
                    {prueba.escenario}
                    <span className="cell-sub">{prueba.herramienta} · {prueba.duracionSegundos} s · {prueba.solicitudesPorSegundo.toFixed(1)} req/s</span>
                  </td>
                  <td className="muted">{prueba.usuariosConcurrentes}</td>
                  <td className="muted">{prueba.totalSolicitudes}{prueba.solicitudesFallidas ? ` (${prueba.solicitudesFallidas} fallidas)` : ''}</td>
                  <td className="muted">{prueba.p95Ms} / {prueba.p99Ms} ms</td>
                  <td><span className={`badge ${prueba.cumple ? 'verde' : 'rojo'}`}>{prueba.cumple ? 'Sí' : 'No'}</span></td>
                  <td className="muted">{formatearFecha(prueba.ejecutadaEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(pruebas.datos?.contenido ?? []).length ? (
            <div className="empty">
              Aún no hay pruebas registradas. El generador está en
              <span className="code"> servicio-auditoria/cmd/carga</span> y guarda el resultado con
              la bandera <span className="code">-registrar</span>.
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <h4 className="k" style={{ marginBottom: 8 }}>Capturas guardadas</h4>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Ventana</th><th>Ruta</th><th>Solicitudes</th><th>p95</th></tr>
            </thead>
            <tbody>
              {(capturas.datos?.contenido ?? []).map((captura) => (
                <tr key={captura.id}>
                  <td className="muted">{formatearFechaHora(captura.ventanaDesde)}</td>
                  <td><span className="code">{captura.metodo}</span> {captura.ruta}</td>
                  <td className="muted">{captura.solicitudes}</td>
                  <td>{captura.p95Ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(capturas.datos?.contenido ?? []).length ? <div className="empty">Todavía no hay capturas guardadas.</div> : null}
        </div>
      </div>
    </div>
  )
}

export default function Operacion() {
  const [restaurando, setRestaurando] = useState(null)
  const [version, setVersion] = useState(0)

  return (
    <>
      <PageHead
        title="Operación"
        sub="Copias de seguridad y su restauración, más los tiempos de respuesta frente al límite de 2 segundos."
        actions={[
          <button key="r" className="btn secondary" type="button" onClick={() => setVersion((v) => v + 1)}>
            Actualizar
          </button>,
        ]}
      />

      <div className="grid grid-2 mt-16">
        <Card
          title="Programación de copias"
          sub="Se ejecuta sola mientras el servicio está en marcha; reiniciar no duplica la copia del día."
          icono={<IconEscudo size={17} />}
        >
          <Programacion />
        </Card>

        <Card title="Ejecuciones" sub="Cada copia deja su archivo comprimido y su checksum." tight>
          <div style={{ padding: 16 }}>
            <Respaldos version={version} onRestaurar={setRestaurando} onCambio={() => setVersion((v) => v + 1)} />
          </div>
        </Card>
      </div>

      <div className="mt-16">
        <Card title="Restauraciones" sub="Pedidas con un motivo y confirmadas por otra persona." tight>
          <div style={{ padding: 16 }}>
            <Restauraciones version={version} onCambio={() => setVersion((v) => v + 1)} />
          </div>
        </Card>
      </div>

      <div className="mt-16">
        <Card title="Rendimiento" sub="Percentiles medidos por el propio servicio, sin agente externo.">
          <Rendimiento />
        </Card>
      </div>

      <div className="mt-16">
        <Note icono={<IconInfo size={17} />}>
          La bitácora conserva todos los hechos: restaurar un respaldo no borra lo que ya
          ocurrió, y cada movimiento del sistema queda encadenado por hash.
        </Note>
      </div>

      {restaurando ? (
        <ModalRestauracion
          respaldo={restaurando}
          onCerrar={() => setRestaurando(null)}
          onHecho={() => { setRestaurando(null); setVersion((v) => v + 1) }}
        />
      ) : null}
    </>
  )
}
