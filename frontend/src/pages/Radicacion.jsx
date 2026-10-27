import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, KV, Modal, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import { crearRadicado, editarRadicado, listarRadicados, obtenerRadicado } from '../api/documentos.js'
import { listarAreas, listarEntidades, listarTiposDocumentales } from '../api/catalogos.js'
import { flujosDisponibles, iniciarTramite, tramiteDeRadicado } from '../api/workflow.js'
import { useSesion } from '../sesion/SesionProvider.jsx'
import {
  CLASES, ESTADOS_RADICADO, ORIGENES_RADICABLES, etiquetaClase, etiquetaEstadoRadicado,
  etiquetaOrigen, formatearDia, formatearFecha, hoyLocal, soloDia,
} from '../util/formato.js'
import {
  IconEditar, IconEscudo, IconFiltro, IconFlujo, IconInfo, IconMas, IconOjo,
} from '../components/Icons.jsx'

const TAMANIO = 10

/** Color del distintivo y del punto según el estado del radicado. */
const TONO_ESTADO = {
  RADICADO: 'azul',
  EN_TRAMITE: 'ambar',
  FINALIZADO: 'verde',
  ANULADO: 'gris',
}

/** Nombre del registro de catálogo al que apunta un id (los catálogos son pequeños). */
function nombreDe(lista, id, campo = 'nombre') {
  if (!id) return '—'
  return (lista ?? []).find((registro) => registro.id === id)?.[campo] ?? '—'
}

/** Opciones de un selector: solo los activos, más el valor actual aunque se haya desactivado. */
function activos(lista, actual) {
  return (lista ?? []).filter((registro) => registro.estado === 'ACTIVO' || registro.id === actual)
}

function DistintivoEstado({ estado }) {
  const tono = TONO_ESTADO[estado] ?? 'gris'
  return (
    <span className={`badge ${tono}`}>
      <span className={`dot ${tono}`} /> {etiquetaEstadoRadicado(estado)}
    </span>
  )
}

/** Estado del trámite de un radicado y puerta para enviarlo a un flujo (HU-062). */
function TramiteRadicado({ radicadoId, estado, onEnviar }) {
  const { puede } = useSesion()
  const consulta = usePeticion(() => tramiteDeRadicado(radicadoId), [radicadoId])
  const tramite = consulta.datos
  const puedeIniciar = puede('flujo:iniciar') && estado === 'RADICADO'

  return (
    <div className="dato">
      <span className="k">Flujo de trabajo</span>
      {consulta.cargando ? <p className="muted small">Consultando el trámite…</p> : null}
      {!consulta.cargando && consulta.error ? (
        <p className="muted small">No se pudo consultar el trámite del radicado.</p>
      ) : null}
      {tramite ? (
        <div className="stack" style={{ gap: 4 }}>
          <p><strong>{tramite.flujoNombre}</strong> · {tramite.pasoActual.nombre}</p>
          <span className="muted small">
            {tramite.estado === 'EN_CURSO' ? 'En curso' : tramite.estado === 'FINALIZADO' ? 'Finalizado' : 'Cancelado'}
            {' · '}iniciado el {formatearFecha(tramite.iniciadoEn)}
          </span>
        </div>
      ) : (!consulta.cargando ? (
        <p className="muted small">Este radicado todavía no está en un flujo de trabajo.</p>
      ) : null)}
      {puedeIniciar && !consulta.cargando && (!tramite || tramite.estado === 'CANCELADO') ? (
        <div>
          <button className="btn secondary sm" type="button" onClick={onEnviar}>
            <IconFlujo size={15} /> {tramite ? 'Enviar otra vez a un flujo' : 'Enviar a un flujo'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** HU-020: detalle del radicado, consultado al abrirlo para no fiarse de la fila. */
function DetalleRadicado({ id, tipos, areas, entidades, onCerrar, onEditar, onEnviarFlujo }) {
  const consulta = usePeticion(() => obtenerRadicado(id), [id])
  const r = consulta.datos
  const navegar = useNavigate()
  const { puede } = useSesion()
  // HU-046: el historial del documento lo arma ms-audit-infra con los eventos que publica
  // este servicio, así que se consulta en la bitácora y no aquí dentro.
  const puedeVerHistorial = puede('bitacora:consultar')

  return (
    <Modal
      open
      title="Detalle del radicado"
      sub={r ? `Registrado el ${formatearFecha(r.radicadoEn)}` : 'Consultando…'}
      onClose={onCerrar}
      ancho="720px"
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cerrar</button>,
        ...(puedeVerHistorial ? [
          <button
            key="h"
            className="btn secondary"
            type="button"
            onClick={() => navegar(`/app/bitacora?radicado=${id}`)}
          >
            <IconEscudo size={15} /> Ver historial
          </button>,
        ] : []),
        ...(onEditar ? [
          <button key="e" className="btn" type="button" onClick={onEditar}>
            <IconEditar size={15} /> Editar metadatos
          </button>,
        ] : []),
      ]}
    >
      {consulta.cargando ? <p className="muted small">Consultando el radicado…</p> : null}
      {consulta.error ? <div className="error-message">{consulta.error}</div> : null}

      {r ? (
        <div className="stack">
          <div className="row between">
            <span className="code">{r.codigo}</span>
            <DistintivoEstado estado={r.estado} />
          </div>

          <div className="dato">
            <span className="k">Asunto</span>
            <p>{r.asunto}</p>
          </div>

          <KV items={[
            { k: 'Tipo documental', v: nombreDe(tipos, r.tipoDocumentalId) },
            { k: 'Origen', v: etiquetaOrigen(r.origen) },
            { k: 'Clase', v: etiquetaClase(r.clase) },
            { k: 'Área', v: nombreDe(areas, r.areaId) },
            { k: 'Entidad', v: nombreDe(entidades, r.entidadId, 'razonSocial') },
            { k: 'Remitente', v: r.remitente },
            { k: 'Destinatario', v: r.destinatario },
            { k: 'Fecha del documento', v: formatearDia(r.fechaDocumento) },
            { k: 'Folios', v: r.folios },
          ]} />

          {r.comentarios ? (
            <div className="dato">
              <span className="k">Comentarios</span>
              <p>{r.comentarios}</p>
            </div>
          ) : null}

          <TramiteRadicado radicadoId={r.id} estado={r.estado} onEnviar={onEnviarFlujo} />
        </div>
      ) : null}
    </Modal>
  )
}

/** HU-017…HU-021, HU-024, HU-039, HU-040: metadatos del radicado. */
function FormularioRadicado({ radicado, tipos, areas, entidades, guardando, error, onCerrar, onGuardar }) {
  const esEdicion = Boolean(radicado)
  const { puede } = useSesion()
  const puedeRecibido = puede('radicados:radicar-recibido')
  const puedeClase = puede('radicados:clase')

  const [origen, setOrigen] = useState(radicado?.origen ?? 'INTERNO')
  const [clase, setClase] = useState(radicado?.clase ?? 'ORIGINAL')
  const [tipoDocumentalId, setTipoDocumentalId] = useState(radicado?.tipoDocumentalId ?? '')
  // Flujo de trabajo con el que arranca el trámite: solo al radicar, y entre los que
  // atienden el tipo documental elegido. Es opcional.
  const [flujoId, setFlujoId] = useState('')
  const flujos = usePeticion(
    () => (esEdicion || !tipoDocumentalId ? Promise.resolve([]) : flujosDisponibles(tipoDocumentalId)),
    [esEdicion, tipoDocumentalId],
  )
  const [areaId, setAreaId] = useState(radicado?.areaId ?? '')
  const [entidadId, setEntidadId] = useState(radicado?.entidadId ?? '')
  const [asunto, setAsunto] = useState(radicado?.asunto ?? '')
  const [remitente, setRemitente] = useState(radicado?.remitente ?? '')
  const [destinatario, setDestinatario] = useState(radicado?.destinatario ?? '')
  const [fechaDocumento, setFechaDocumento] = useState(soloDia(radicado?.fechaDocumento) || hoyLocal())
  const [folios, setFolios] = useState(radicado?.folios ?? 1)
  const [comentarios, setComentarios] = useState(radicado?.comentarios ?? '')

  // HU-018: el tipo documental declara qué orígenes admite; el servicio rechaza el resto.
  const tiposDisponibles = activos(tipos, tipoDocumentalId).filter((tipo) => (tipo.origenes ?? []).includes(origen))
  // HU-024: solo quien tenga el permiso puede radicar documentos Recibido.
  const origenes = ORIGENES_RADICABLES.filter((o) => o.valor !== 'RECIBIDO' || puedeRecibido)

  function cambiarOrigen(valor) {
    setOrigen(valor)
    // Si el tipo elegido no admite el origen nuevo, se limpia para no enviar una
    // combinación que el servicio va a rechazar.
    const actual = (tipos ?? []).find((tipo) => tipo.id === tipoDocumentalId)
    if (actual && !(actual.origenes ?? []).includes(valor)) setTipoDocumentalId('')
  }

  function enviar(e) {
    e.preventDefault()
    const datos = {
      tipoDocumentalId,
      areaId: areaId || undefined,
      entidadId: entidadId || null,
      asunto: asunto.trim(),
      remitente: remitente.trim(),
      destinatario: destinatario.trim(),
      fechaDocumento,
      folios: Number(folios) || 1,
      comentarios: comentarios.trim() || null,
    }
    if (esEdicion) {
      // HU-021: el código y el origen no se editan; la clase solo con su permiso. La
      // versión viaja para que dos ediciones a la vez no se pisen.
      if (puedeClase) datos.clase = clase
      datos.version = radicado.version
    } else {
      datos.origen = origen
      datos.clase = clase
      if (flujoId) datos.flujoId = flujoId
    }
    onGuardar(datos)
  }

  return (
    <Modal
      open
      title={esEdicion ? `Editar radicado · ${radicado.codigo}` : 'Nuevo radicado'}
      sub={esEdicion
        ? 'El código y el origen no se editan: son la identidad del documento.'
        : 'El código se asigna al guardar, con la fecha de hoy y un consecutivo del día.'}
      onClose={onCerrar}
      ancho="720px"
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-radicado" disabled={guardando}>
          {guardando ? 'Guardando…' : (esEdicion ? 'Guardar cambios' : 'Radicar')}
        </button>,
      ]}
    >
      <form id="form-radicado" className="form-form" onSubmit={enviar}>
        <div className="field">
          <label id="radicado-origen">Origen del documento <span className="req">*</span></label>
          {esEdicion ? (
            <p className="muted small">{etiquetaOrigen(radicado.origen)}</p>
          ) : (
            <div className="opciones" role="radiogroup" aria-labelledby="radicado-origen">
              {origenes.map((o) => (
                <label key={o.valor} className="switch">
                  <input
                    type="radio"
                    name="radicado-origen"
                    value={o.valor}
                    checked={origen === o.valor}
                    onChange={() => cambiarOrigen(o.valor)}
                  />
                  <span>{o.etiqueta}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label id="radicado-clase">Clase del documento</label>
          {puedeClase ? (
            <div className="opciones" role="radiogroup" aria-labelledby="radicado-clase">
              {CLASES.map((c) => (
                <label key={c.valor} className="switch">
                  <input
                    type="radio"
                    name="radicado-clase"
                    value={c.valor}
                    checked={clase === c.valor}
                    onChange={() => setClase(c.valor)}
                  />
                  <span>{c.etiqueta}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="muted small">Original</p>
          )}
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="radicado-tipo">Tipo documental <span className="req">*</span></label>
            <select id="radicado-tipo" value={tipoDocumentalId} onChange={(e) => { setTipoDocumentalId(e.target.value); setFlujoId('') }}>
              <option value="">Selecciona el tipo…</option>
              {tiposDisponibles.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>
              ))}
            </select>
            {!tiposDisponibles.length ? (
              <span className="hint">Ningún tipo documental activo admite documentos de origen {etiquetaOrigen(origen).toLowerCase()}.</span>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="radicado-area">Área</label>
            <select id="radicado-area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">La de mi usuario</option>
              {activos(areas, areaId).map((area) => (
                <option key={area.id} value={area.id}>{area.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {!esEdicion && tipoDocumentalId && (flujos.datos ?? []).length ? (
          <div className="field">
            <label htmlFor="radicado-flujo">Flujo de trabajo</label>
            <select id="radicado-flujo" value={flujoId} onChange={(e) => setFlujoId(e.target.value)}>
              <option value="">Sin flujo por ahora</option>
              {flujos.datos.map((flujo) => (
                <option key={flujo.id} value={flujo.id}>{flujo.nombre}</option>
              ))}
            </select>
            <span className="hint">Con un flujo, el documento arranca su trámite en el primer paso.</span>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="radicado-asunto">Asunto <span className="req">*</span></label>
          <input
            id="radicado-asunto"
            type="text"
            maxLength={300}
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            placeholder="Ej. Solicitud de certificado de residencia"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="radicado-remitente">Remitente <span className="req">*</span></label>
            <input
              id="radicado-remitente"
              type="text"
              maxLength={160}
              value={remitente}
              onChange={(e) => setRemitente(e.target.value)}
              placeholder="Quién envía el documento"
            />
          </div>
          <div className="field">
            <label htmlFor="radicado-destinatario">Destinatario <span className="req">*</span></label>
            <input
              id="radicado-destinatario"
              type="text"
              maxLength={160}
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="A quién va dirigido"
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="radicado-fecha">Fecha del documento <span className="req">*</span></label>
            <input
              id="radicado-fecha"
              type="date"
              max={hoyLocal()}
              value={fechaDocumento}
              onChange={(e) => setFechaDocumento(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="radicado-folios">Folios <span className="req">*</span></label>
            <input
              id="radicado-folios"
              type="number"
              min="1"
              max="100000"
              value={folios}
              onChange={(e) => setFolios(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="radicado-entidad">Entidad</label>
            <select id="radicado-entidad" value={entidadId} onChange={(e) => setEntidadId(e.target.value)}>
              <option value="">Sin entidad</option>
              {activos(entidades, entidadId).map((entidad) => (
                <option key={entidad.id} value={entidad.id}>{entidad.razonSocial}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="radicado-comentarios">Comentarios</label>
          <textarea
            id="radicado-comentarios"
            rows="3"
            maxLength={2000}
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Notas internas sobre el documento (opcional)"
          />
        </div>

        {error ? (
          <div className="error-message">
            {error.message}
            {error.detalles?.length ? (
              <div className="detalles">
                {error.detalles.map((detalle) => <span key={detalle}>· {detalle}</span>)}
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </Modal>
  )
}

/**
 * HU-062: elegir el flujo al que se envía un radicado ya registrado. Solo se ofrecen los
 * flujos activos que atienden el tipo documental del radicado.
 */
function ModalEnviarFlujo({ radicado, onCerrar, onEnviar }) {
  const [flujoId, setFlujoId] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const flujos = usePeticion(() => flujosDisponibles(radicado.tipoDocumentalId), [radicado.tipoDocumentalId])
  const disponibles = flujos.datos ?? []

  async function enviar(evento) {
    evento.preventDefault()
    if (!flujoId) return
    setEnviando(true)
    setError(null)
    try {
      await onEnviar(flujoId)
      onCerrar()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open
      title="Enviar a un flujo de trabajo"
      sub={`${radicado.codigo} · ${radicado.asunto}`}
      onClose={onCerrar}
      ancho="560px"
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="e" className="btn" type="submit" form="form-flujo-destino" disabled={!flujoId || enviando}>
          {enviando ? 'Enviando…' : 'Enviar al flujo'}
        </button>,
      ]}
    >
      <form id="form-flujo-destino" className="stack" onSubmit={enviar}>
        <div className="field">
          <label htmlFor="flujo-destino">Flujo publicado <span className="req">*</span></label>
          <select id="flujo-destino" value={flujoId} onChange={(e) => setFlujoId(e.target.value)}>
            <option value="">Selecciona el flujo…</option>
            {disponibles.map((flujo) => (
              <option key={flujo.id} value={flujo.id}>{flujo.nombre}</option>
            ))}
          </select>
          {flujos.cargando ? (
            <span className="hint">Consultando los flujos disponibles…</span>
          ) : flujos.error ? (
            <span className="hint">No se pudieron consultar los flujos disponibles.</span>
          ) : !disponibles.length ? (
            <span className="hint">Ningún flujo activo atiende el tipo documental de este radicado. Vincúlalo desde «Flujos».</span>
          ) : (
            <span className="hint">El radicado pasa al paso inicial del flujo y aparece en la bandeja de su responsable.</span>
          )}
        </div>

        {error ? (
          <div className="error-message">
            {error.message}
            {error.detalles?.length ? (
              <div className="detalles">
                {error.detalles.map((detalle) => <span key={detalle}>· {detalle}</span>)}
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </Modal>
  )
}

export default function Radicacion() {
  const { puede } = useSesion()
  const [pagina, setPagina] = useState(0)
  const [fCodigo, setFCodigo] = useState('')
  const [fTexto, setFTexto] = useState('')
  const [fOrigen, setFOrigen] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [modal, setModal] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)
  const [aviso, setAviso] = useState('')
  const [enviandoAFlujo, setEnviandoAFlujo] = useState(null)

  const radicados = usePeticion(() => listarRadicados({
    codigo: fCodigo, q: fTexto, origen: fOrigen, tipoDocumentalId: fTipo, estado: fEstado,
    pagina, tamanio: TAMANIO,
  }), [fCodigo, fTexto, fOrigen, fTipo, fEstado, pagina])

  // Los catálogos se piden completos: la lista necesita el nombre de un tipo o de un
  // área aunque después se hayan desactivado, y los selectores filtran por estado.
  const tipos = usePeticion(() => listarTiposDocumentales(), [])
  const areas = usePeticion(() => listarAreas(), [])
  const entidades = usePeticion(() => listarEntidades(), [])

  const lista = radicados.datos?.contenido ?? []
  const total = radicados.datos?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANIO))

  const puedeCrear = puede('radicados:crear')
  const puedeEditar = puede('radicados:editar')

  function filtrar(accion) {
    accion()
    setPagina(0)
  }

  async function guardar(datos) {
    setGuardando(true)
    setErrorAccion(null)
    try {
      if (modal?.modo === 'editar') await editarRadicado(modal.radicado.id, datos)
      else setAviso((await crearRadicado(datos)).advertencia ?? '')
      setModal(null)
      radicados.recargar()
    } catch (fallo) {
      setErrorAccion(fallo)
    } finally {
      setGuardando(false)
    }
  }

  /** HU-062: enviar un radicado existente al paso inicial del flujo elegido. */
  async function enviarAFlujo(radicadoId, flujoId) {
    await iniciarTramite({ radicadoId, flujoId })
    radicados.recargar()
    setDetalle(radicadoId)
  }

  return (
    <>
      {aviso ? <div className="error-message" role="alert">{aviso}</div> : null}
      <PageHead
        title="Radicación"
        sub="Registra los documentos que entran y salen de la entidad con su código de radicado, y consulta los ya registrados."
        actions={puedeCrear ? [
          <button
            key="n"
            className="btn"
            type="button"
            disabled={!tipos.datos || !areas.datos}
            onClick={() => { setErrorAccion(null); setModal({ modo: 'crear' }) }}
          >
            <IconMas size={16} /> Nuevo radicado
          </button>,
        ] : []}
      />

      <div className="toolbar">
        <label className="field grow" style={{ maxWidth: 320 }}>
          <input
            type="search"
            aria-label="Buscar por asunto, remitente o destinatario"
            placeholder="Buscar por asunto, remitente…"
            value={fTexto}
            onChange={(e) => filtrar(() => setFTexto(e.target.value))}
          />
        </label>
        <label className="field" style={{ minWidth: 140 }}>
          <input
            type="search"
            aria-label="Buscar por código de radicado"
            placeholder="Código"
            value={fCodigo}
            onChange={(e) => filtrar(() => setFCodigo(e.target.value))}
          />
        </label>
        <label className="field" style={{ minWidth: 170 }}>
          <select aria-label="Tipo documental" value={fTipo} onChange={(e) => filtrar(() => setFTipo(e.target.value))}>
            <option value="">Todos los tipos</option>
            {(tipos.datos ?? []).map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 140 }}>
          <select aria-label="Origen" value={fOrigen} onChange={(e) => filtrar(() => setFOrigen(e.target.value))}>
            <option value="">Todos los orígenes</option>
            {ORIGENES_RADICABLES.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 150 }}>
          <select aria-label="Estado" value={fEstado} onChange={(e) => filtrar(() => setFEstado(e.target.value))}>
            <option value="">Todos los estados</option>
            {ESTADOS_RADICADO.map((estado) => <option key={estado.valor} value={estado.valor}>{estado.etiqueta}</option>)}
          </select>
        </label>
        <span className="badge azul" style={{ marginLeft: 'auto' }}>
          <IconFiltro size={13} /> {lista.length} de {total}
        </span>
      </div>

      {errorAccion ? <div className="error-message mt-16">{errorAccion.message}</div> : null}

      <Card className="mt-16" tight>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Radicado</th>
                <th>Asunto</th>
                <th>Tipo documental</th>
                <th>Origen</th>
                <th>Estado</th>
                <th>Radicado el</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((radicado) => (
                <tr key={radicado.id} onClick={() => setDetalle(radicado.id)}>
                  <td>
                    <span className="code">{radicado.codigo}</span>
                    <span className="cell-sub">
                      {etiquetaClase(radicado.clase)} · {radicado.folios} {radicado.folios === 1 ? 'folio' : 'folios'}
                    </span>
                  </td>
                  <td>
                    <strong>{radicado.asunto}</strong>
                    <span className="cell-sub">{radicado.remitente} → {radicado.destinatario}</span>
                  </td>
                  <td>{nombreDe(tipos.datos, radicado.tipoDocumentalId)}</td>
                  <td><span className="badge blanco">{etiquetaOrigen(radicado.origen)}</span></td>
                  <td><DistintivoEstado estado={radicado.estado} /></td>
                  <td className="muted">{formatearFecha(radicado.radicadoEn)}</td>
                  <td>
                    <div className="td-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn ghost sm"
                        type="button"
                        title="Ver detalle"
                        onClick={() => setDetalle(radicado.id)}
                      >
                        <IconOjo size={15} />
                      </button>
                      {puedeEditar ? (
                        <button
                          className="btn ghost sm"
                          type="button"
                          title="Editar metadatos"
                          onClick={() => { setErrorAccion(null); setModal({ modo: 'editar', radicado }) }}
                        >
                          <IconEditar size={15} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!lista.length ? (
            <div className="empty">
              {radicados.cargando ? 'Cargando radicados…' : radicados.error || 'Ningún radicado coincide con los filtros.'}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="row between mt-16">
        <span className="muted small">
          Página {pagina + 1} de {totalPaginas} · {total} {total === 1 ? 'radicado' : 'radicados'}
        </span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary sm" type="button" disabled={pagina === 0} onClick={() => setPagina((p) => Math.max(0, p - 1))}>Anterior</button>
          <button className="btn secondary sm" type="button" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
        </div>
      </div>

      <div className="mt-16">
        <Note icono={<IconInfo size={17} />}>
          El código de radicado se asigna al guardar y no cambia después: la fecha (AAAAMMDD),
          el dígito del origen y el consecutivo del día. El origen tampoco se edita, porque
          identifica de dónde llegó el documento.
        </Note>
      </div>

      {detalle ? (
        <DetalleRadicado
          id={detalle}
          tipos={tipos.datos}
          areas={areas.datos}
          entidades={entidades.datos}
          onCerrar={() => setDetalle(null)}
          onEditar={puedeEditar ? () => {
            const radicado = lista.find((fila) => fila.id === detalle) ?? null
            setDetalle(null)
            if (radicado) setModal({ modo: 'editar', radicado })
          } : null}
          onEnviarFlujo={() => {
            const radicado = lista.find((fila) => fila.id === detalle) ?? null
            setDetalle(null)
            if (radicado) setEnviandoAFlujo(radicado)
          }}
        />
      ) : null}

      {modal ? (
        <FormularioRadicado
          radicado={modal.modo === 'editar' ? modal.radicado : null}
          tipos={tipos.datos}
          areas={areas.datos}
          entidades={entidades.datos}
          guardando={guardando}
          error={errorAccion}
          onCerrar={() => { setModal(null); setErrorAccion(null) }}
          onGuardar={guardar}
        />
      ) : null}

      {enviandoAFlujo ? (
        <ModalEnviarFlujo
          radicado={enviandoAFlujo}
          onCerrar={() => setEnviandoAFlujo(null)}
          onEnviar={(flujoId) => enviarAFlujo(enviandoAFlujo.id, flujoId)}
        />
      ) : null}
    </>
  )
}
