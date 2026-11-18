import { useMemo, useState } from 'react'
import { Card, KV, Modal, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import {
  accesosDeCarpeta,
  arbolExpediente,
  cargarAnexoDeExpediente,
  crearCarpeta,
  crearDocumentoDeExpediente,
  desactivarCarpeta,
  editarCarpeta,
  reemplazarAccesosDeCarpeta,
} from '../api/documentos.js'
import { listarAreas } from '../api/catalogos.js'
import { listarRoles } from '../api/roles.js'
import { useSesion } from '../sesion/SesionProvider.jsx'
import { formatearFecha } from '../util/formato.js'
import { IconArchivo, IconCarpeta, IconInfo, IconMas } from '../components/Icons.jsx'

/**
 * Expediente central (HU-030…HU-034): árbol de carpetas por área, subcarpetas
 * temáticas, accesos por rol o área y documentos No radicables.
 *
 * El servicio ya devuelve solo las carpetas que la sesión puede ver; esta pantalla no
 * vuelve a decidir la visibilidad, solo dibuja el árbol y ofrece las acciones que el
 * nivel de acceso permite.
 */

const NOMBRE_NIVEL = { VER: 'Consultar', CARGAR: 'Cargar', ADMINISTRAR: 'Administrar' }

/** Aplana el árbol para poder buscar una carpeta por id sin recorrerlo en cada render. */
function indiceDe(raices) {
  const mapa = new Map()
  const recorrer = (nodos) => {
    for (const nodo of nodos) {
      mapa.set(nodo.id, nodo)
      recorrer(nodo.carpetas ?? [])
    }
  }
  recorrer(raices)
  return mapa
}

function Rama({ nodo, nivel, seleccionada, onSeleccionar }) {
  return (
    <li>
      <button
        type="button"
        className={`arbol-nodo${seleccionada === nodo.id ? ' activo' : ''}`}
        style={{ paddingLeft: `${10 + nivel * 16}px` }}
        onClick={() => onSeleccionar(nodo.id)}
      >
        <IconCarpeta size={15} />
        <span>{nodo.nombre}</span>
        {nodo.documentos?.length || nodo.radicados?.length ? (
          <span className="badge gris">{(nodo.documentos?.length ?? 0) + (nodo.radicados?.length ?? 0)}</span>
        ) : null}
      </button>
      {nodo.carpetas?.length ? (
        <ul>
          {nodo.carpetas.map((hija) => (
            <Rama key={hija.id} nodo={hija} nivel={nivel + 1} seleccionada={seleccionada} onSeleccionar={onSeleccionar} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** HU-030, HU-031: crear una carpeta raíz o una subcarpeta. */
function ModalCarpeta({ padre, areas, onCerrar, onCreada }) {
  const [nombre, setNombre] = useState('')
  const [tipoExpediente, setTipoExpediente] = useState('')
  const [areaId, setAreaId] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await crearCarpeta({
        nombre: nombre.trim(),
        ...(tipoExpediente.trim() ? { tipoExpediente: tipoExpediente.trim() } : {}),
        ...(padre ? { padreId: padre.id } : areaId ? { areaId } : {}),
      })
      onCreada()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      title={padre ? 'Nueva subcarpeta' : 'Nueva carpeta raíz'}
      sub={padre ? padre.ruta : 'Cada área tiene una sola carpeta raíz'}
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-carpeta" disabled={guardando || nombre.trim().length < 2}>
          {guardando ? 'Guardando…' : 'Crear carpeta'}
        </button>,
      ]}
    >
      <form id="form-carpeta" className="stack" onSubmit={guardar}>
        <div className="field">
          <label htmlFor="carpeta-nombre">Nombre <span className="req">*</span></label>
          <input
            id="carpeta-nombre"
            type="text"
            value={nombre}
            maxLength={120}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Contratos 2026"
          />
        </div>
        <div className="field">
          <label htmlFor="carpeta-tipo">Tipo de expediente</label>
          <input
            id="carpeta-tipo"
            type="text"
            value={tipoExpediente}
            maxLength={80}
            onChange={(e) => setTipoExpediente(e.target.value)}
            placeholder="Ej. Contratación (opcional)"
          />
        </div>
        {!padre ? (
          <div className="field">
            <label htmlFor="carpeta-area">Área dueña</label>
            <select id="carpeta-area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Mi área</option>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
            </select>
          </div>
        ) : null}
        {error ? <div className="error-message">{error.message}</div> : null}
      </form>
    </Modal>
  )
}

/** HU-034: documento No radicable con su archivo. */
function ModalDocumento({ carpeta, onCerrar, onCreado }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const documento = await crearDocumentoDeExpediente(carpeta.id, {
        titulo: titulo.trim(),
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      })
      if (archivo) await cargarAnexoDeExpediente(documento.id, archivo)
      onCreado()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      title="Nuevo documento No radicable"
      sub={carpeta.ruta}
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-documento" disabled={guardando || titulo.trim().length < 3}>
          {guardando ? 'Guardando…' : 'Cargar documento'}
        </button>,
      ]}
    >
      <form id="form-documento" className="stack" onSubmit={guardar}>
        <div className="field">
          <label htmlFor="documento-titulo">Título <span className="req">*</span></label>
          <input id="documento-titulo" type="text" value={titulo} maxLength={200}
            onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Acta de visita" />
        </div>
        <div className="field">
          <label htmlFor="documento-descripcion">Descripción</label>
          <textarea id="documento-descripcion" rows="3" maxLength={1000} value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="documento-archivo">Archivo</label>
          <input id="documento-archivo" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          <span className="hint">Opcional: el documento se crea aunque no traiga archivo todavía.</span>
        </div>
        {error ? <div className="error-message">{error.message}</div> : null}
      </form>
    </Modal>
  )
}

/** HU-033: accesos por rol o área que se heredan a las subcarpetas. */
function ModalAccesos({ carpeta, roles, areas, onCerrar, onGuardado }) {
  const actuales = usePeticion(() => accesosDeCarpeta(carpeta.id), [carpeta.id])
  const [nuevos, setNuevos] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const existentes = useMemo(
    () => actuales.datos ?? [],
    [actuales.datos],
  )
  const lista = nuevos ?? existentes
  const clave = (acceso) => `${acceso.tipoSujeto}|${acceso.sujetoId}`

  function alternar(tipoSujeto, sujetoId) {
    const actual = lista.find((acceso) => acceso.tipoSujeto === tipoSujeto && acceso.sujetoId === sujetoId)
    setNuevos(actual
      ? lista.filter((acceso) => clave(acceso) !== `${tipoSujeto}|${sujetoId}`)
      : [...lista, { tipoSujeto, sujetoId, nivel: 'CARGAR' }])
  }

  function cambiarNivel(tipoSujeto, sujetoId, nivel) {
    setNuevos(lista.map((acceso) => (
      acceso.tipoSujeto === tipoSujeto && acceso.sujetoId === sujetoId ? { ...acceso, nivel } : acceso
    )))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await reemplazarAccesosDeCarpeta(carpeta.id, lista)
      onGuardado()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  const grupos = [
    { titulo: 'Roles', tipo: 'ROL', sujetos: roles },
    { titulo: 'Áreas', tipo: 'AREA', sujetos: areas },
  ]

  return (
    <Modal
      open
      title="Accesos de la carpeta"
      sub={carpeta.ruta}
      onClose={onCerrar}
      ancho="620px"
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="button" disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar accesos'}
        </button>,
      ]}
    >
      <div className="stack">
        <Note icono={<IconInfo size={17} />}>
          El área dueña siempre administra. Lo que se concede aquí se hereda a las
          subcarpetas de esta carpeta.
        </Note>
        {actuales.error ? <div className="error-message">{actuales.error}</div> : null}
        {grupos.map((grupo) => (
          <div key={grupo.tipo}>
            <h4 className="k" style={{ marginBottom: 8 }}>{grupo.titulo}</h4>
            <div className="lista-checks">
              {grupo.sujetos.map((sujeto) => {
                const acceso = lista.find((item) => item.tipoSujeto === grupo.tipo && item.sujetoId === sujeto.id)
                return (
                  <div key={sujeto.id} className="row between">
                    <label className="check">
                      <input type="checkbox" checked={Boolean(acceso)} onChange={() => alternar(grupo.tipo, sujeto.id)} />
                      <span>{sujeto.nombre}</span>
                    </label>
                    {acceso ? (
                      <select
                        aria-label={`Nivel de ${sujeto.nombre}`}
                        value={acceso.nivel}
                        onChange={(e) => cambiarNivel(grupo.tipo, sujeto.id, e.target.value)}
                      >
                        <option value="VER">Consultar</option>
                        <option value="CARGAR">Cargar</option>
                        <option value="ADMINISTRAR">Administrar</option>
                      </select>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {error ? <div className="error-message">{error.message}</div> : null}
      </div>
    </Modal>
  )
}

export default function Expediente() {
  const arbol = usePeticion(arbolExpediente, [])
  const areas = usePeticion(() => listarAreas({ estado: 'ACTIVO', tamano: 100 }), [])
  const roles = usePeticion(listarRoles, [])
  const { puede } = useSesion()
  const [seleccionada, setSeleccionada] = useState('')
  const [modal, setModal] = useState(null)
  const [aviso, setAviso] = useState(null)

  const raices = arbol.datos ?? []
  const indice = useMemo(() => indiceDe(raices), [raices])
  const carpeta = indice.get(seleccionada) ?? raices[0] ?? null
  const administra = puede('expediente:administrar')
  const carga = puede('expediente:cargar') || administra

  async function desactivar() {
    setAviso(null)
    try {
      await desactivarCarpeta(carpeta.id)
      setSeleccionada('')
      arbol.recargar()
    } catch (fallo) {
      setAviso(fallo)
    }
  }

  return (
    <>
      <PageHead
        title="Expediente"
        sub="Carpetas por área, subcarpetas temáticas y documentos No radicables. El árbol solo muestra lo que tu rol puede ver."
        actions={[
          administra ? (
            <button key="n" className="btn" type="button" onClick={() => setModal({ tipo: 'carpeta' })}>
              <IconMas size={16} /> Nueva carpeta
            </button>
          ) : null,
        ]}
      />

      {arbol.error ? <div className="error-message">{arbol.error}</div> : null}
      {aviso ? (
        <div className="error-message">
          {aviso.message}
          {aviso.detalles?.length ? (
            <div className="detalles">{aviso.detalles.map((texto) => <span key={texto}>· {texto}</span>)}</div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-side mt-16">
        <Card title="Árbol del expediente" icono={<IconCarpeta size={17} />} tight>
          {arbol.cargando ? <div className="empty">Cargando las carpetas…</div> : null}
          {!arbol.cargando && !raices.length ? (
            <div className="empty">
              No hay carpetas a la vista. {administra ? 'Crea la carpeta raíz de un área para empezar.' : 'Pide acceso al administrador del expediente.'}
            </div>
          ) : null}
          {raices.length ? (
            <ul className="arbol">
              {raices.map((nodo) => (
                <Rama key={nodo.id} nodo={nodo} nivel={0} seleccionada={carpeta?.id} onSeleccionar={setSeleccionada} />
              ))}
            </ul>
          ) : null}
        </Card>

        <div className="stack">
          {carpeta ? (
            <>
              <Card
                title={carpeta.nombre}
                sub={carpeta.ruta}
                actions={[
                  carga ? (
                    <button key="d" className="btn secondary sm" type="button" onClick={() => setModal({ tipo: 'documento' })}>
                      <IconArchivo size={15} /> Documento
                    </button>
                  ) : null,
                  administra ? (
                    <button key="s" className="btn secondary sm" type="button" onClick={() => setModal({ tipo: 'carpeta', padre: carpeta })}>
                      <IconMas size={15} /> Subcarpeta
                    </button>
                  ) : null,
                  administra ? (
                    <button key="a" className="btn ghost sm" type="button" onClick={() => setModal({ tipo: 'accesos' })}>
                      Accesos
                    </button>
                  ) : null,
                ]}
              >
                <KV items={[
                  { k: 'Nivel', v: NOMBRE_NIVEL[carpeta.nivel] ?? carpeta.nivel },
                  { k: 'Tipo de expediente', v: carpeta.tipoExpediente ?? '—' },
                  { k: 'Subcarpetas', v: carpeta.carpetas.length },
                  { k: 'Radicados archivados', v: carpeta.radicados.length },
                ]} />

                {administra ? (
                  <div className="row" style={{ marginTop: 12 }}>
                    <button
                      className="btn ghost sm"
                      type="button"
                      onClick={() => setModal({ tipo: 'editar', carpeta })}
                    >
                      Renombrar
                    </button>
                    <button className="btn ghost sm danger" type="button" onClick={desactivar}>
                      Desactivar carpeta
                    </button>
                  </div>
                ) : null}
              </Card>

              <Card title="Documentos No radicables" icono={<IconArchivo size={17} />} tight>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr><th>Consecutivo</th><th>Título</th><th>Cargado</th></tr>
                    </thead>
                    <tbody>
                      {carpeta.documentos.map((documento) => (
                        <tr key={documento.id}>
                          <td><span className="code">{String(documento.consecutivo).padStart(4, '0')}</span></td>
                          <td>
                            <strong>{documento.titulo}</strong>
                            {documento.descripcion ? <span className="cell-sub">{documento.descripcion}</span> : null}
                          </td>
                          <td className="muted">{formatearFecha(documento.cargadoEn)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!carpeta.documentos.length ? <div className="empty">Todavía no hay documentos en esta carpeta.</div> : null}
                </div>
              </Card>

              <Card title="Radicados archivados" tight>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr><th>Radicado</th><th>Asunto</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {carpeta.radicados.map((radicado) => (
                        <tr key={radicado.id}>
                          <td><span className="code">{radicado.codigo}</span></td>
                          <td>{radicado.asunto}</td>
                          <td className="muted">{radicado.estado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!carpeta.radicados.length ? <div className="empty">Ningún radicado se ha archivado aquí.</div> : null}
                </div>
              </Card>
            </>
          ) : (
            <Card><div className="empty">Elige una carpeta del árbol para ver su contenido.</div></Card>
          )}
        </div>
      </div>

      <div className="mt-16">
        <Note icono={<IconInfo size={17} />}>
          Los documentos No radicables se cargan directo en la carpeta y no reciben código de
          radicado. Los radicados aparecen aquí cuando se archivan en la carpeta.
        </Note>
      </div>

      {modal?.tipo === 'carpeta' ? (
        <ModalCarpeta
          padre={modal.padre ?? null}
          areas={areas.datos ?? []}
          onCerrar={() => setModal(null)}
          onCreada={() => { setModal(null); arbol.recargar() }}
        />
      ) : null}

      {modal?.tipo === 'documento' ? (
        <ModalDocumento
          carpeta={carpeta}
          onCerrar={() => setModal(null)}
          onCreado={() => { setModal(null); arbol.recargar() }}
        />
      ) : null}

      {modal?.tipo === 'accesos' ? (
        <ModalAccesos
          carpeta={carpeta}
          roles={roles.datos ?? []}
          areas={areas.datos ?? []}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); arbol.recargar() }}
        />
      ) : null}

      {modal?.tipo === 'editar' ? (
        <ModalCarpetaEditar
          carpeta={carpeta}
          onCerrar={() => setModal(null)}
          onGuardada={() => { setModal(null); arbol.recargar() }}
        />
      ) : null}
    </>
  )
}

/** HU-031: renombrar o cambiar el tipo de expediente de la carpeta. */
function ModalCarpetaEditar({ carpeta, onCerrar, onGuardada }) {
  const [nombre, setNombre] = useState(carpeta.nombre)
  const [tipoExpediente, setTipoExpediente] = useState(carpeta.tipoExpediente ?? '')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await editarCarpeta(carpeta.id, {
        nombre: nombre.trim(),
        tipoExpediente: tipoExpediente.trim() || null,
      })
      onGuardada()
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      title="Editar carpeta"
      sub={carpeta.ruta}
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-carpeta-editar" disabled={guardando || nombre.trim().length < 2}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>,
      ]}
    >
      <form id="form-carpeta-editar" className="stack" onSubmit={guardar}>
        <div className="field">
          <label htmlFor="editar-nombre">Nombre <span className="req">*</span></label>
          <input id="editar-nombre" type="text" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="editar-tipo">Tipo de expediente</label>
          <input id="editar-tipo" type="text" value={tipoExpediente} maxLength={80} onChange={(e) => setTipoExpediente(e.target.value)} />
        </div>
        {error ? <div className="error-message">{error.message}</div> : null}
      </form>
    </Modal>
  )
}
