import { useMemo, useState } from 'react'
import { Modal } from './ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import {
  copiasEnviadas,
  enviarCopia,
  generarDesdePlantilla,
  listarPlantillas,
  obtenerPlantilla,
} from '../api/documentos.js'
import { listarUsuarios } from '../api/usuarios.js'
import { formatearFecha } from '../util/formato.js'
import { IconAdjuntar, IconInfo } from './Icons.jsx'

/**
 * Copias informativas (HU-041) y generación desde plantilla (HU-037, HU-038), dentro del
 * detalle del radicado.
 *
 * La copia no cambia el trámite: solo aparece en la bandeja secundaria del destinatario.
 * La plantilla se renderiza en el servidor con los metadatos del radicado y produce DOCX y
 * PDF, que quedan anexos al documento.
 */

function ModalCopia({ radicado, onCerrar, onEnviada }) {
  const usuarios = usePeticion(() => listarUsuarios({ estado: 'ACTIVO', tamano: 100 }), [])
  const [destinatarioId, setDestinatarioId] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await enviarCopia(radicado.id, {
        destinatarioId,
        ...(mensaje.trim() ? { mensaje: mensaje.trim() } : {}),
      })
      onEnviada()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      title="Enviar copia"
      sub={`${radicado.codigo} · ${radicado.asunto}`}
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="e" className="btn" type="submit" form="form-copia" disabled={guardando || !destinatarioId}>
          {guardando ? 'Enviando…' : 'Enviar copia'}
        </button>,
      ]}
    >
      <form id="form-copia" className="stack" onSubmit={enviar}>
        <div className="field">
          <label htmlFor="copia-destinatario">Destinatario <span className="req">*</span></label>
          <select id="copia-destinatario" value={destinatarioId} onChange={(e) => setDestinatarioId(e.target.value)}>
            <option value="">Elige un usuario</option>
            {(usuarios.datos?.contenido ?? []).map((usuario) => (
              <option key={usuario.id} value={usuario.id}>{usuario.nombre} · {usuario.correo}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="copia-mensaje">Mensaje</label>
          <textarea id="copia-mensaje" rows="3" maxLength={500} value={mensaje}
            onChange={(e) => setMensaje(e.target.value)} placeholder="Para tu conocimiento" />
        </div>
        {error ? <div className="error-message">{error.message}</div> : null}
      </form>
    </Modal>
  )
}

function ModalGenerar({ radicado, plantillas, onCerrar, onGenerado }) {
  const [plantillaId, setPlantillaId] = useState('')
  const [valores, setValores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [generado, setGenerado] = useState(null)

  const disponibles = useMemo(
    () => plantillas.filter((plantilla) => plantilla.estado === 'ACTIVA' && (plantilla.origenes ?? []).includes(radicado.origen)),
    [plantillas, radicado.origen],
  )
  const detalle = usePeticion(
    () => (plantillaId ? obtenerPlantilla(plantillaId) : Promise.resolve(null)),
    [plantillaId],
  )
  const variables = detalle.datos?.variables ?? []

  async function generar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const resultado = await generarDesdePlantilla(radicado.id, { plantillaId, datos: valores })
      setGenerado(resultado)
      onGenerado()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      title="Generar desde plantilla"
      sub={`${radicado.codigo} · origen ${radicado.origen}`}
      onClose={onCerrar}
      ancho="640px"
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cerrar</button>,
        generado ? null : (
          <button key="g" className="btn" type="submit" form="form-generar" disabled={guardando || !plantillaId}>
            {guardando ? 'Generando…' : 'Generar DOCX y PDF'}
          </button>
        ),
      ]}
    >
      {generado ? (
        <div className="stack">
          <div className="aviso-ok">
            Documento generado: {generado.docx?.nombreOriginal} y {generado.pdf?.nombreOriginal}.
          </div>
          <p className="muted small">Los dos archivos quedaron como anexos del radicado.</p>
        </div>
      ) : (
        <form id="form-generar" className="stack" onSubmit={generar}>
          <div className="field">
            <label htmlFor="generar-plantilla">Plantilla <span className="req">*</span></label>
            <select id="generar-plantilla" value={plantillaId} onChange={(e) => { setPlantillaId(e.target.value); setValores({}) }}>
              <option value="">Elige una plantilla</option>
              {disponibles.map((plantilla) => (
                <option key={plantilla.id} value={plantilla.id}>{plantilla.nombre}</option>
              ))}
            </select>
            {!disponibles.length ? (
              <span className="hint">
                No hay plantillas activas vinculadas al origen {radicado.origen}. Un administrador
                puede vincularlas desde Plantillas.
              </span>
            ) : null}
          </div>

          {variables.length ? (
            <div className="stack">
              <span className="hint">
                Los campos vacíos se completan con los metadatos del radicado; escribe solo lo
                que quieras reemplazar.
              </span>
              {variables.map((variable) => (
                <div className="field" key={variable.etiqueta}>
                  <label htmlFor={`variable-${variable.etiqueta}`}>
                    {`{{${variable.etiqueta}}}`}{variable.obligatoria ? <span className="req"> *</span> : null}
                  </label>
                  <input
                    id={`variable-${variable.etiqueta}`}
                    type="text"
                    value={valores[variable.etiqueta] ?? ''}
                    onChange={(e) => setValores((actuales) => ({ ...actuales, [variable.etiqueta]: e.target.value }))}
                    placeholder={`Metadato: ${variable.campoOrigen}`}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="error-message">
              {error.message}
              {error.detalles?.length ? (
                <div className="detalles">{error.detalles.map((texto) => <span key={texto}>· {texto}</span>)}</div>
              ) : null}
            </div>
          ) : null}
        </form>
      )}
    </Modal>
  )
}

export function CopiasYPlantillas({ radicado, puedeCopiar, puedeUsarPlantillas }) {
  const enviadas = usePeticion(() => copiasEnviadas(radicado.id), [radicado.id])
  const plantillas = usePeticion(listarPlantillas, [])
  const [modal, setModal] = useState(null)
  const [aviso, setAviso] = useState('')

  const copias = enviadas.datos ?? []

  return (
    <div className="stack">
      <div className="dato">
        <div className="row between">
          <span className="k">Copias informativas</span>
          {puedeCopiar ? (
            <button className="btn ghost sm" type="button" onClick={() => setModal('copia')}>
              <IconAdjuntar size={15} /> Enviar copia
            </button>
          ) : null}
        </div>

        {aviso ? <div className="aviso-ok">{aviso}</div> : null}
        {enviadas.error ? <div className="error-message">{enviadas.error}</div> : null}

        {copias.length ? (
          <ul className="lista-simple">
            {copias.map((copia) => (
              <li key={copia.id}>
                <span>
                  {copia.destinatario?.nombre ?? copia.destinatarioId.slice(0, 8)}
                  <small className="muted" style={{ display: 'block' }}>
                    {copia.leidaEn ? `Leída el ${formatearFecha(copia.leidaEn)}` : 'Sin leer'} · enviada el {formatearFecha(copia.enviadaEn)}
                  </small>
                </span>
                {copia.mensaje ? <span className="muted small">{copia.mensaje}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">{enviadas.cargando ? 'Consultando las copias…' : 'No se han enviado copias de este radicado.'}</p>
        )}
      </div>

      {puedeUsarPlantillas ? (
        <div className="dato">
          <div className="row between">
            <span className="k">Documentos generados</span>
            <button className="btn ghost sm" type="button" onClick={() => setModal('plantilla')}>
              Generar desde plantilla
            </button>
          </div>
          <span className="hint">
            <IconInfo size={13} /> Se generan el DOCX y su PDF y quedan anexos al radicado.
          </span>
        </div>
      ) : null}

      {modal === 'copia' ? (
        <ModalCopia
          radicado={radicado}
          onCerrar={() => setModal(null)}
          onEnviada={() => {
            setModal(null)
            setAviso('La copia quedó en la bandeja del destinatario.')
            enviadas.recargar()
          }}
        />
      ) : null}

      {modal === 'plantilla' ? (
        <ModalGenerar
          radicado={radicado}
          plantillas={plantillas.datos ?? []}
          onCerrar={() => setModal(null)}
          onGenerado={() => setAviso('El documento generado quedó anexo al radicado.')}
        />
      ) : null}
    </div>
  )
}

export default CopiasYPlantillas
