import { useState } from 'react'
import { Card, Modal, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import {
  editarPlantilla,
  listarPlantillas,
  obtenerPlantilla,
  reemplazarOrigenesDePlantilla,
  reemplazarVariablesDePlantilla,
  subirPlantilla,
} from '../api/documentos.js'
import { formatearFecha } from '../util/formato.js'
import { IconArchivo, IconInfo, IconOjo, IconAdjuntar } from '../components/Icons.jsx'

/**
 * Plantillas DOCX (HU-035…HU-038).
 *
 * Se sube el documento con marcadores `{{campo}}`; el servicio los detecta y los
 * convierte en variables. Aquí se declara qué campo del radicado precarga cada una y
 * con qué orígenes se puede usar. La generación del DOCX y del PDF se hace desde el
 * detalle del radicado, que es donde están sus datos.
 */

const ORIGENES = [
  { valor: 'INTERNO', etiqueta: 'Interno' },
  { valor: 'EXTERNO', etiqueta: 'Externo' },
]

function ModalVariables({ plantillaId, onCerrar, onGuardado }) {
  const detalle = usePeticion(() => obtenerPlantilla(plantillaId), [plantillaId])
  const [cambios, setCambios] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const originales = detalle.datos?.variables ?? []
  const variables = cambios ?? originales

  function editar(etiqueta, campo, valor) {
    setCambios(variables.map((variable) => (
      variable.etiqueta === etiqueta ? { ...variable, [campo]: valor } : variable
    )))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await reemplazarVariablesDePlantilla(plantillaId, variables.map((variable) => ({
        etiqueta: variable.etiqueta,
        campoOrigen: variable.campoOrigen,
        obligatoria: variable.obligatoria,
      })))
      onGuardado()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      title="Variables de la plantilla"
      sub={detalle.datos?.nombre ?? 'Consultando…'}
      onClose={onCerrar}
      ancho="680px"
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="button" disabled={guardando || !detalle.datos} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar variables'}
        </button>,
      ]}
    >
      {detalle.cargando ? <p className="muted small">Consultando la plantilla…</p> : null}
      {detalle.error ? <div className="error-message">{detalle.error}</div> : null}

      {detalle.datos ? (
        <div className="stack">
          <Note icono={<IconInfo size={17} />}>
            Cada variable corresponde a un marcador del DOCX. El campo de origen es el
            metadato del radicado que la precarga al generar el documento.
          </Note>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Marcador</th><th>Campo del radicado</th><th>Obligatoria</th></tr>
              </thead>
              <tbody>
                {variables.map((variable) => (
                  <tr key={variable.etiqueta}>
                    <td><span className="code">{`{{${variable.etiqueta}}}`}</span></td>
                    <td>
                      <input
                        type="text"
                        aria-label={`Campo de ${variable.etiqueta}`}
                        value={variable.campoOrigen}
                        maxLength={80}
                        onChange={(e) => editar(variable.etiqueta, 'campoOrigen', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${variable.etiqueta} obligatoria`}
                        checked={variable.obligatoria}
                        onChange={(e) => editar(variable.etiqueta, 'obligatoria', e.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!variables.length ? (
              <div className="empty">El DOCX no tiene marcadores: agrega `{'{{campo}}'}` y vuelve a subirlo.</div>
            ) : null}
          </div>
          {error ? <div className="error-message">{error.message}</div> : null}
        </div>
      ) : null}
    </Modal>
  )
}

function ModalOrigenes({ plantilla, onCerrar, onGuardado }) {
  const [origenes, setOrigenes] = useState(plantilla.origenes ?? [])
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  function alternar(valor) {
    setOrigenes((actuales) => (
      actuales.includes(valor) ? actuales.filter((origen) => origen !== valor) : [...actuales, valor]
    ))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await reemplazarOrigenesDePlantilla(plantilla.id, origenes)
      onGuardado()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      title="Orígenes de la plantilla"
      sub={plantilla.nombre}
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="button" disabled={guardando || !origenes.length} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>,
      ]}
    >
      <div className="stack">
        <p className="muted small">
          La plantilla solo se puede usar con radicados de los orígenes marcados. Recibido
          no se admite: una plantilla no se aplica a correspondencia que ya llegó.
        </p>
        <div className="opciones">
          {ORIGENES.map((origen) => (
            <label key={origen.valor} className="check">
              <input type="checkbox" checked={origenes.includes(origen.valor)} onChange={() => alternar(origen.valor)} />
              <span>{origen.etiqueta}</span>
            </label>
          ))}
        </div>
        {error ? <div className="error-message">{error.message}</div> : null}
      </div>
    </Modal>
  )
}

function ModalEditar({ plantilla, onCerrar, onGuardado }) {
  const [nombre, setNombre] = useState(plantilla.nombre)
  const [descripcion, setDescripcion] = useState(plantilla.descripcion ?? '')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await editarPlantilla(plantilla.id, { nombre: nombre.trim(), descripcion: descripcion.trim() || null })
      onGuardado()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      title="Editar plantilla"
      sub={plantilla.nombre}
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-plantilla" disabled={guardando || nombre.trim().length < 3}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>,
      ]}
    >
      <form id="form-plantilla" className="stack" onSubmit={guardar}>
        <div className="field">
          <label htmlFor="plantilla-nombre">Nombre <span className="req">*</span></label>
          <input id="plantilla-nombre" type="text" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="plantilla-descripcion">Descripción</label>
          <textarea id="plantilla-descripcion" rows="3" maxLength={500} value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        {error ? <div className="error-message">{error.message}</div> : null}
      </form>
    </Modal>
  )
}

export default function Plantillas() {
  const lista = usePeticion(listarPlantillas, [])
  const [modal, setModal] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)

  const plantillas = lista.datos ?? []

  async function subir(evento) {
    const archivo = evento.target.files?.[0]
    if (!archivo) return
    setSubiendo(true)
    setError(null)
    try {
      await subirPlantilla(archivo)
      lista.recargar()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setSubiendo(false)
      evento.target.value = ''
    }
  }

  async function alternarEstado(plantilla) {
    setError(null)
    try {
      await editarPlantilla(plantilla.id, { estado: plantilla.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA' })
      lista.recargar()
    } catch (fallo) {
      setError(fallo)
    }
  }

  return (
    <>
      <PageHead
        title="Plantillas"
        sub="Documentos DOCX con variables que se completan con los metadatos del radicado. Al generar se produce el DOCX y su PDF, y quedan anexos al radicado."
        actions={[
          <label key="s" className={`btn${subiendo ? ' disabled' : ''}`} style={{ cursor: subiendo ? 'wait' : 'pointer' }}>
            <IconAdjuntar size={16} /> {subiendo ? 'Subiendo…' : 'Subir plantilla'}
            <input type="file" accept=".docx" hidden disabled={subiendo} onChange={subir} />
          </label>,
        ]}
      />

      {error ? <div className="error-message">{error.message}</div> : null}
      {lista.error ? <div className="error-message">{lista.error}</div> : null}

      <Card className="mt-16" tight>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Plantilla</th>
                <th>Variables</th>
                <th>Orígenes</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plantillas.map((plantilla) => (
                <tr key={plantilla.id}>
                  <td>
                    <strong>{plantilla.nombre}</strong>
                    <span className="cell-sub">
                      {plantilla.descripcion ?? `Versión ${plantilla.version} · ${formatearFecha(plantilla.creadoEn)}`}
                    </span>
                  </td>
                  <td className="muted">{plantilla.variables?.length ?? 0}</td>
                  <td className="muted">{(plantilla.origenes ?? []).join(' · ') || '—'}</td>
                  <td>
                    <span className={`badge ${plantilla.estado === 'ACTIVA' ? 'verde' : 'gris'}`}>
                      {plantilla.estado === 'ACTIVA' ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    <div className="td-actions">
                      <button className="btn ghost sm" type="button" onClick={() => setModal({ tipo: 'variables', id: plantilla.id })}>
                        <IconOjo size={15} /> Variables
                      </button>
                      <button className="btn ghost sm" type="button" onClick={() => setModal({ tipo: 'origenes', plantilla })}>
                        Orígenes
                      </button>
                      <button className="btn ghost sm" type="button" onClick={() => setModal({ tipo: 'editar', plantilla })}>
                        Editar
                      </button>
                      <button className="btn ghost sm" type="button" onClick={() => alternarEstado(plantilla)}>
                        {plantilla.estado === 'ACTIVA' ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!plantillas.length ? (
            <div className="empty">
              {lista.cargando
                ? 'Cargando las plantillas…'
                : 'Todavía no hay plantillas. Sube un DOCX con marcadores como {{asunto}} o {{remitente}}.'}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="mt-16">
        <Note icono={<IconInfo size={17} />}>
          Al generar, las variables se completan con los metadatos del radicado y, si falta
          alguna obligatoria, se piden los valores. El PDF se produce en el servidor y también
          queda como anexo.
        </Note>
      </div>

      {modal?.tipo === 'variables' ? (
        <ModalVariables
          plantillaId={modal.id}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); lista.recargar() }}
        />
      ) : null}

      {modal?.tipo === 'origenes' ? (
        <ModalOrigenes
          plantilla={modal.plantilla}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); lista.recargar() }}
        />
      ) : null}

      {modal?.tipo === 'editar' ? (
        <ModalEditar
          plantilla={modal.plantilla}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); lista.recargar() }}
        />
      ) : null}
    </>
  )
}
