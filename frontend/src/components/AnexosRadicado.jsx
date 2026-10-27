import { useState } from 'react'
import { Modal } from './ui.jsx'
import { cargarAnexo, descargarAnexo, eliminarAnexo, listarAnexos } from '../api/documentos.js'
import { usePeticion } from '../api/usePeticion.js'
import { formatearFecha } from '../util/formato.js'
import { guardarArchivo, tamanoLegible } from '../util/archivos.js'
import { IconAdjuntar, IconDescargar, IconInfo, IconPapelera } from './Icons.jsx'

/** Extensiones que acepta el servicio (HU-026); el navegador filtra el diálogo. */
const ACEPTADOS = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx'

/**
 * Anexos de un radicado (HU-025…HU-029): adjuntar, listar, descargar y eliminar con
 * motivo. El archivo viaja como cuerpo binario y la descarga va autenticada, así que
 * se recibe como Blob y se guarda desde el navegador.
 */
export function AnexosRadicado({ radicadoId, puedeCargar, puedeEliminar }) {
  const lista = usePeticion(() => listarAnexos(radicadoId), [radicadoId])
  const [subiendo, setSubiendo] = useState(false)
  const [descargando, setDescargando] = useState('')
  const [porEliminar, setPorEliminar] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState(null)

  const anexos = lista.datos ?? []

  async function subir(evento) {
    const archivo = evento.target.files?.[0]
    if (!archivo) return
    setSubiendo(true)
    setError(null)
    try {
      await cargarAnexo(radicadoId, archivo)
      lista.recargar()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setSubiendo(false)
      // Permite volver a elegir el mismo archivo si el primer intento falló.
      evento.target.value = ''
    }
  }

  async function descargar(anexo) {
    setDescargando(anexo.id)
    setError(null)
    try {
      const { blob, nombre } = await descargarAnexo(anexo.id)
      guardarArchivo(blob, nombre)
    } catch (fallo) {
      setError(fallo)
    } finally {
      setDescargando('')
    }
  }

  async function confirmarEliminacion() {
    setError(null)
    try {
      await eliminarAnexo(porEliminar.id, motivo.trim())
      setPorEliminar(null)
      setMotivo('')
      lista.recargar()
    } catch (fallo) {
      setError(fallo)
      setPorEliminar(null)
    }
  }

  return (
    <div className="dato">
      <div className="row between">
        <span className="k">Anexos</span>
        {puedeCargar ? (
          <label className={`btn secondary sm${subiendo ? ' disabled' : ''}`} style={{ cursor: subiendo ? 'wait' : 'pointer' }}>
            <IconAdjuntar size={15} /> {subiendo ? 'Cargando…' : 'Adjuntar archivo'}
            <input
              type="file"
              accept={ACEPTADOS}
              hidden
              disabled={subiendo}
              onChange={subir}
            />
          </label>
        ) : null}
      </div>

      {lista.error ? <div className="error-message">{lista.error}</div> : null}
      {error ? <div className="error-message">{error.message}</div> : null}

      {anexos.length ? (
        <ul className="lista-simple">
          {anexos.map((anexo) => (
            <li key={anexo.id}>
              <span>
                {anexo.nombreOriginal}
                <small className="muted" style={{ display: 'block' }}>
                  {tamanoLegible(anexo.tamanoBytes)} · cargado el {formatearFecha(anexo.cargadoEn)}
                </small>
              </span>
              <button
                className="btn ghost sm"
                type="button"
                title="Descargar"
                disabled={descargando === anexo.id}
                onClick={() => descargar(anexo)}
              >
                <IconDescargar size={15} />
              </button>
              {puedeEliminar ? (
                <button
                  className="btn ghost sm"
                  type="button"
                  title="Eliminar el anexo"
                  onClick={() => { setPorEliminar(anexo); setMotivo('') }}
                >
                  <IconPapelera size={15} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">
          {lista.cargando ? 'Consultando los anexos…' : 'Este radicado no tiene anexos.'}
        </p>
      )}

      {puedeCargar && !anexos.length ? (
        <span className="hint">
          <IconInfo size={13} /> PDF, PNG, JPG, DOCX o XLSX. Máximo 10 MB por archivo.
        </span>
      ) : null}

      {porEliminar ? (
        <Modal
          open
          title="Eliminar anexo"
          sub={porEliminar.nombreOriginal}
          onClose={() => setPorEliminar(null)}
          footer={[
            <button key="c" className="btn secondary" type="button" onClick={() => setPorEliminar(null)}>Cancelar</button>,
            <button
              key="e"
              className="btn danger"
              type="button"
              disabled={motivo.trim().length < 3}
              onClick={confirmarEliminacion}
            >
              Eliminar
            </button>,
          ]}
        >
          <div className="field">
            <label htmlFor="motivo-anexo">Motivo de la eliminación <span className="req">*</span></label>
            <textarea
              id="motivo-anexo"
              rows="3"
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Se adjuntó el archivo equivocado"
            />
            <span className="hint">
              El anexo deja de verse, pero queda la constancia de quién lo eliminó y por qué.
            </span>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

export default AnexosRadicado
