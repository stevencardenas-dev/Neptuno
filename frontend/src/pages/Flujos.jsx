import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Modal, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import { crearFlujo, editarFlujo, listarFlujos } from '../api/workflow.js'
import { useSesion } from '../sesion/SesionProvider.jsx'
import { formatearFecha } from '../util/formato.js'
import { IconEditar, IconFiltro, IconFlujo, IconInfo, IconMas } from '../components/Icons.jsx'

const TAMANIO = 15

/** Los tres momentos en que puede estar un flujo. */
const ESTADOS = [
  { valor: 'BORRADOR', etiqueta: 'Borrador', tono: 'gris' },
  { valor: 'ACTIVO', etiqueta: 'Activo', tono: 'verde' },
  { valor: 'INACTIVO', etiqueta: 'Inactivo', tono: 'ambar' },
]

function estadoDe(valor) {
  return ESTADOS.find((estado) => estado.valor === valor) ?? { etiqueta: valor, tono: 'gris' }
}

/** Formulario de creación y edición (HU-048 y HU-049). */
function FormularioFlujo({ flujo, onCerrar, onGuardado }) {
  const editando = Boolean(flujo)
  const [nombre, setNombre] = useState(flujo?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(flujo?.descripcion ?? '')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento) {
    evento.preventDefault()
    if (guardando) return
    setGuardando(true)
    setError(null)
    try {
      const cuerpo = { nombre: nombre.trim(), descripcion: descripcion.trim() || null }
      if (editando) await editarFlujo(flujo.id, cuerpo)
      else await crearFlujo(cuerpo)
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
      title={editando ? 'Editar flujo' : 'Nuevo flujo'}
      sub={editando ? 'Los trámites que ya están en curso no cambian.' : 'Un flujo nuevo nace en borrador: no se usa hasta que se publique.'}
      onClose={onCerrar}
      ancho="640px"
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar} disabled={guardando}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-flujo" disabled={guardando}>
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear flujo'}
        </button>,
      ]}
    >
      <form id="form-flujo" className="stack" onSubmit={guardar}>
        <label className="field">
          <span className="k">Nombre</span>
          <input
            id="flujo-nombre"
            type="text"
            required
            minLength={3}
            maxLength={120}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Por ejemplo: Pago de cuentas de cobro"
          />
        </label>

        <label className="field">
          <span className="k">Descripción</span>
          <textarea
            id="flujo-descripcion"
            rows="3"
            maxLength={500}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Para qué sirve este flujo (opcional)"
          />
        </label>

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

export default function Flujos() {
  const { puede } = useSesion()
  const [pagina, setPagina] = useState(0)
  const [fTexto, setFTexto] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [modal, setModal] = useState(null)

  const flujos = usePeticion(
    () => listarFlujos({ q: fTexto, estado: fEstado, pagina, tamanio: TAMANIO }),
    [fTexto, fEstado, pagina],
  )

  const lista = flujos.datos?.contenido ?? []
  const total = flujos.datos?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANIO))
  const puedeDisenar = puede('flujos:administrar')

  function filtrar(accion) {
    accion()
    setPagina(0)
  }

  function trasGuardar() {
    setModal(null)
    flujos.recargar()
  }

  return (
    <>
      <PageHead
        title="Flujos"
        sub="El camino que recorre un documento: qué pasos tiene, quién atiende cada uno y cuánto puede tardar."
        actions={puedeDisenar ? (
          <button className="btn" type="button" onClick={() => setModal({ flujo: null })}>
            <IconMas size={16} /> Nuevo flujo
          </button>
        ) : null}
      />

      <div className="toolbar">
        <label className="field grow" style={{ maxWidth: 340 }}>
          <input
            type="search"
            aria-label="Buscar flujos por nombre o descripción"
            placeholder="Buscar por nombre o descripción…"
            value={fTexto}
            onChange={(e) => filtrar(() => setFTexto(e.target.value))}
          />
        </label>

        <label className="field" style={{ minWidth: 170 }}>
          <select
            aria-label="Estado del flujo"
            value={fEstado}
            onChange={(e) => filtrar(() => setFEstado(e.target.value))}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((estado) => (
              <option key={estado.valor} value={estado.valor}>{estado.etiqueta}</option>
            ))}
          </select>
        </label>

        <span className="badge azul" style={{ marginLeft: 'auto' }}>
          <IconFiltro size={13} /> {lista.length} de {total}
        </span>
      </div>

      <Card className="mt-16" tight>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Flujo</th>
                <th style={{ width: 120 }}>Estado</th>
                <th style={{ width: 130 }}>Versiones</th>
                <th style={{ width: 190 }}>Último cambio</th>
                {puedeDisenar ? <th style={{ width: 110, textAlign: 'right' }}>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {lista.map((flujo) => {
                const estado = estadoDe(flujo.estado)
                return (
                  <tr key={flujo.id}>
                    <td>
                      <strong>{flujo.nombre}</strong>
                      {flujo.descripcion ? <span className="cell-sub">{flujo.descripcion}</span> : null}
                    </td>
                    <td><span className={`badge ${estado.tono}`}>{estado.etiqueta}</span></td>
                    <td className="muted">
                      {flujo.versiones === 0
                        ? 'Sin versión'
                        : `${flujo.versiones} ${flujo.versiones === 1 ? 'versión' : 'versiones'}`}
                    </td>
                    <td className="muted">{formatearFecha(flujo.actualizadoEn ?? flujo.creadoEn)}</td>
                    {puedeDisenar ? (
                      <td>
                        <div className="td-actions">
                          <Link
                            className="btn ghost sm"
                            to={`/app/flujos/${flujo.id}`}
                            title="Diseñar el recorrido: pasos, decisiones y responsables"
                          >
                            <IconFlujo size={15} />
                          </Link>
                          <button
                            className="btn ghost sm"
                            type="button"
                            title="Editar el nombre o la descripción"
                            onClick={() => setModal({ flujo })}
                          >
                            <IconEditar size={15} />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!lista.length ? (
            <div className="empty">
              {flujos.cargando ? 'Cargando los flujos…' : flujos.error || 'Todavía no hay flujos que mostrar.'}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="row between mt-16">
        <span className="muted small">
          Página {pagina + 1} de {totalPaginas} · {total} {total === 1 ? 'flujo' : 'flujos'}
        </span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary sm" type="button" disabled={pagina === 0} onClick={() => setPagina((p) => Math.max(0, p - 1))}>Anterior</button>
          <button className="btn secondary sm" type="button" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
        </div>
      </div>

      <div className="mt-16">
        <Note icono={<IconInfo size={17} />}>
          Cada flujo guarda su definición por versiones: cuando se publique una versión nueva,
          los trámites que ya empezaron siguen con la definición con la que nacieron.
        </Note>
      </div>

      {modal ? (
        <FormularioFlujo flujo={modal.flujo} onCerrar={() => setModal(null)} onGuardado={trasGuardar} />
      ) : null}
    </>
  )
}
