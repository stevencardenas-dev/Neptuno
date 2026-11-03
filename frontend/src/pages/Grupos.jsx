import { useMemo, useState } from 'react'
import { Card, Modal, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import { crearGrupo, editarGrupo, eliminarGrupo, listarGrupos, reemplazarMiembrosDeGrupo } from '../api/workflow.js'
import { listarUsuarios } from '../api/usuarios.js'
import { formatearFecha } from '../util/formato.js'
import { IconInfo, IconMas, IconPapelera } from '../components/Icons.jsx'

/**
 * Grupos de trabajo (HU-069).
 *
 * Un paso del flujo puede asignarse a un grupo: cualquiera de sus miembros atiende la
 * tarea, que es lo que necesitan los equipos que se turnan el mismo trabajo. Los
 * miembros se validan contra el catálogo de usuarios al guardar.
 */

function ModalGrupo({ grupo, usuarios, onCerrar, onGuardado }) {
  const [nombre, setNombre] = useState(grupo?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(grupo?.descripcion ?? '')
  const [miembros, setMiembros] = useState(grupo?.miembros ?? [])
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return usuarios
    return usuarios.filter((usuario) => `${usuario.nombre} ${usuario.correo}`.toLowerCase().includes(texto))
  }, [usuarios, busqueda])

  function alternar(id) {
    setMiembros((actuales) => (actuales.includes(id) ? actuales.filter((miembro) => miembro !== id) : [...actuales, id]))
  }

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const datos = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        miembros,
      }
      if (grupo) await editarGrupo(grupo.id, { nombre: datos.nombre, descripcion: datos.descripcion })
      else await crearGrupo(datos)
      // Los miembros se reemplazan aparte: editar el grupo no toca su composición.
      if (grupo) await reemplazarMiembrosDeGrupo(grupo.id, miembros)
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
      title={grupo ? 'Editar grupo' : 'Nuevo grupo de trabajo'}
      sub={grupo ? grupo.nombre : 'Cualquiera de sus miembros puede atender el paso'}
      onClose={onCerrar}
      ancho="640px"
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-grupo" disabled={guardando || nombre.trim().length < 3}>
          {guardando ? 'Guardando…' : 'Guardar grupo'}
        </button>,
      ]}
    >
      <form id="form-grupo" className="stack" onSubmit={guardar}>
        <div className="field">
          <label htmlFor="grupo-nombre">Nombre <span className="req">*</span></label>
          <input id="grupo-nombre" type="text" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Equipo de tesorería" />
        </div>
        <div className="field">
          <label htmlFor="grupo-descripcion">Descripción</label>
          <textarea id="grupo-descripcion" rows="2" maxLength={300} value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="grupo-buscar">Miembros <span className="req">*</span></label>
          <input id="grupo-buscar" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo" />
        </div>

        <div className="lista-checks" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {visibles.map((usuario) => (
            <label key={usuario.id} className="check">
              <input type="checkbox" checked={miembros.includes(usuario.id)} onChange={() => alternar(usuario.id)} />
              <span>{usuario.nombre}<small className="muted" style={{ display: 'block' }}>{usuario.correo}</small></span>
            </label>
          ))}
        </div>
        <span className="hint">{miembros.length} seleccionados. Un grupo admite hasta 200 miembros.</span>

        {error ? <div className="error-message">{error.message}</div> : null}
      </form>
    </Modal>
  )
}

export default function Grupos() {
  const grupos = usePeticion(listarGrupos, [])
  const usuarios = usePeticion(() => listarUsuarios({ estado: 'ACTIVO', tamano: 100 }), [])
  const [modal, setModal] = useState(null)
  const [error, setError] = useState(null)

  const lista = grupos.datos ?? []
  const personas = usuarios.datos?.contenido ?? []
  const nombreDe = (id) => personas.find((usuario) => usuario.id === id)?.nombre ?? id.slice(0, 8)

  async function borrar(grupo) {
    setError(null)
    try {
      await eliminarGrupo(grupo.id)
      grupos.recargar()
    } catch (fallo) {
      setError(fallo)
    }
  }

  return (
    <>
      <PageHead
        title="Grupos de trabajo"
        sub="Conjuntos de personas que atienden un paso en conjunto. Al diseñar el flujo, el responsable del paso puede ser un grupo."
        actions={[
          <button key="n" className="btn" type="button" onClick={() => setModal({})}>
            <IconMas size={16} /> Nuevo grupo
          </button>,
        ]}
      />

      {error ? <div className="error-message">{error.message}</div> : null}
      {grupos.error ? <div className="error-message">{grupos.error}</div> : null}

      <div className="grid grid-2 mt-16">
        {lista.map((grupo) => (
          <Card
            key={grupo.id}
            title={grupo.nombre}
            sub={grupo.descripcion ?? 'Sin descripción'}
            actions={[
              <button key="e" className="btn ghost sm" type="button" onClick={() => setModal({ grupo })}>Editar</button>,
              <button key="b" className="btn ghost sm danger" type="button" onClick={() => borrar(grupo)}>
                <IconPapelera size={15} />
              </button>,
            ]}
          >
            <p className="muted small" style={{ marginBottom: 8 }}>
              {grupo.miembros.length} {grupo.miembros.length === 1 ? 'miembro' : 'miembros'} · creado el {formatearFecha(grupo.creadoEn)}
            </p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {grupo.miembros.map((miembro) => (
                <span key={miembro} className="badge gris">{nombreDe(miembro)}</span>
              ))}
              {!grupo.miembros.length ? <span className="muted small">Todavía no tiene miembros.</span> : null}
            </div>
          </Card>
        ))}
      </div>

      {!lista.length ? (
        <Card className="mt-16">
          <div className="empty">
            {grupos.cargando ? 'Cargando los grupos…' : 'No hay grupos de trabajo. Crea uno para asignar un paso a un equipo.'}
          </div>
        </Card>
      ) : null}

      <div className="mt-16">
        <Note icono={<IconInfo size={17} />}>
          Los miembros deben ser usuarios activos. Al desactivar un usuario, su grupo sigue
          existiendo; el servicio deja de ofrecerle tareas cuando ya no puede entrar.
        </Note>
      </div>

      {modal ? (
        <ModalGrupo
          grupo={modal.grupo}
          usuarios={personas}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); grupos.recargar() }}
        />
      ) : null}
    </>
  )
}
