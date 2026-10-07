import { useState } from 'react'
import { Card, Modal, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import {
  crearArea, crearEntidad, crearTipoDocumental, desactivarArea, desactivarEntidad,
  desactivarTipoDocumental, editarArea, editarEntidad, editarTipoDocumental,
  listarAreas, listarEntidades, listarTiposDocumentales,
} from '../api/catalogos.js'
import { useSesion } from '../sesion/SesionProvider.jsx'
import { ORIGENES, etiquetaEstadoCatalogo, etiquetaOrigen } from '../util/formato.js'
import {
  IconArchivo, IconCheck, IconConfig, IconEditar, IconEscudo, IconGlobo, IconMas, IconPapelera,
} from '../components/Icons.jsx'

const tabs = [
  { id: 'tipos', label: 'Tipos documentales' },
  { id: 'areas', label: 'Áreas' },
  { id: 'entidades', label: 'Entidades' },
]

const estadoBadge = { ACTIVO: 'verde', INACTIVO: 'gris' }

/** Formulario de áreas (HU-016). */
function FormularioArea({ registro, guardando, error, onCerrar, onGuardar }) {
  const [codigo, setCodigo] = useState(registro?.codigo ?? '')
  const [nombre, setNombre] = useState(registro?.nombre ?? '')
  const [responsable, setResponsable] = useState(registro?.responsable ?? '')
  const [estado, setEstado] = useState(registro?.estado ?? 'ACTIVO')

  return (
    <Modal
      open
      title={registro ? `Editar área · ${registro.nombre}` : 'Nueva área'}
      sub="Las áreas asignan cada documento y usuario al área correspondiente"
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-area" disabled={guardando}>
          <IconCheck size={16} /> {guardando ? 'Guardando…' : 'Guardar área'}
        </button>,
      ]}
    >
      <form id="form-area" className="form-form" onSubmit={(e) => { e.preventDefault(); onGuardar({ codigo, nombre, responsable, estado }) }}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="area-codigo">Código</label>
            <input id="area-codigo" type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. PLAN" />
          </div>
          <div className="field">
            <label htmlFor="area-nombre">Nombre del área <span className="req">*</span></label>
            <input id="area-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Planeación" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="area-responsable">Responsable</label>
            <input id="area-responsable" type="text" value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre del responsable" />
          </div>
          <div className="field">
            <label htmlFor="area-estado">Estado</label>
            <select id="area-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>
        </div>
        {error ? <div className="error-message">{error}</div> : null}
      </form>
    </Modal>
  )
}

/** Formulario de tipos documentales (HU-015). */
function FormularioTipo({ registro, guardando, error, onCerrar, onGuardar }) {
  const [nombre, setNombre] = useState(registro?.nombre ?? '')
  const [prefijo, setPrefijo] = useState(registro?.prefijo ?? '')
  const [origenes, setOrigenes] = useState(() => Array.from(registro?.origenes ?? ['INTERNO']))
  const [estado, setEstado] = useState(registro?.estado ?? 'ACTIVO')

  function alternarOrigen(valor) {
    setOrigenes((actuales) => (actuales.includes(valor) ? actuales.filter((o) => o !== valor) : [...actuales, valor]))
  }

  return (
    <Modal
      open
      title={registro ? `Editar tipo documental · ${registro.nombre}` : 'Nuevo tipo documental'}
      sub="Clasifican cada radicado y definen los orígenes permitidos"
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-tipo" disabled={guardando}>
          <IconCheck size={16} /> {guardando ? 'Guardando…' : 'Guardar tipo'}
        </button>,
      ]}
    >
      <form id="form-tipo" className="form-form" onSubmit={(e) => { e.preventDefault(); onGuardar({ nombre, prefijo, origenes, estado }) }}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="tipo-nombre">Nombre <span className="req">*</span></label>
            <input id="tipo-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Orden de servicio" />
          </div>
          <div className="field">
            <label htmlFor="tipo-prefijo">Prefijo</label>
            <input id="tipo-prefijo" type="text" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} placeholder="OS" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="tipo-estado">Estado</label>
            <select id="tipo-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label id="tipo-origenes">Orígenes permitidos <span className="req">*</span></label>
          <div className="row" role="group" aria-labelledby="tipo-origenes">
            {ORIGENES.map((origen) => (
              <label key={origen.valor} className="switch">
                <input type="checkbox" checked={origenes.includes(origen.valor)} onChange={() => alternarOrigen(origen.valor)} />
                {origen.etiqueta}
              </label>
            ))}
          </div>
          <span className="hint">El dígito del origen hace parte del formato AAAAMMDD + X + CONSECUTIVO.</span>
        </div>
        {error ? <div className="error-message">{error}</div> : null}
      </form>
    </Modal>
  )
}

/** Formulario de entidades (HU-022). */
function FormularioEntidad({ registro, guardando, error, onCerrar, onGuardar }) {
  const [nit, setNit] = useState(registro?.nit ?? '')
  const [razonSocial, setRazonSocial] = useState(registro?.razonSocial ?? '')
  const [ciudad, setCiudad] = useState(registro?.ciudad ?? '')
  const [tipo, setTipo] = useState(registro?.tipo ?? 'Proveedor')
  const [estado, setEstado] = useState(registro?.estado ?? 'ACTIVO')

  return (
    <Modal
      open
      title={registro ? `Editar entidad · ${registro.razonSocial}` : 'Nueva entidad'}
      sub="NIT y razón social requeridos para radicar origen Recibido o generar origen Externo"
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-entidad" disabled={guardando}>
          <IconCheck size={16} /> {guardando ? 'Guardando…' : 'Guardar entidad'}
        </button>,
      ]}
    >
      <form id="form-entidad" className="form-form" onSubmit={(e) => { e.preventDefault(); onGuardar({ nit, razonSocial, ciudad, tipo, estado }) }}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="entidad-nit">NIT <span className="req">*</span></label>
            <input id="entidad-nit" type="text" value={nit} onChange={(e) => setNit(e.target.value)} placeholder="900.000.000-0" />
          </div>
          <div className="field">
            <label htmlFor="entidad-razonSocial">Razón social <span className="req">*</span></label>
            <input id="entidad-razonSocial" type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} placeholder="Nombre de la entidad" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="entidad-ciudad">Ciudad</label>
            <input id="entidad-ciudad" type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Bogotá" />
          </div>
          <div className="field">
            <label htmlFor="entidad-tipo">Tipo</label>
            <select id="entidad-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option>Proveedor</option><option>Entidad pública</option><option>Cliente</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="entidad-estado">Estado</label>
          <select id="entidad-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
          </select>
        </div>
        {error ? <div className="error-message">{error}</div> : null}
      </form>
    </Modal>
  )
}

/** Botones de edición y activación/desactivación reutilizados por las tres tablas. */
function Acciones({ registro, administrable, guardando, onEditar, onCambiarEstado }) {
  if (!administrable) return <span className="muted small">Solo lectura</span>
  return (
    <div className="td-actions">
      <button className="btn ghost sm" type="button" title="Editar" disabled={guardando} onClick={() => onEditar(registro)}>
        <IconEditar size={15} />
      </button>
      <button
        className="btn ghost sm"
        type="button"
        disabled={guardando}
        title={registro.estado === 'ACTIVO' ? 'Desactivar' : 'Reactivar'}
        onClick={() => onCambiarEstado(registro)}
      >
        <IconPapelera size={15} />
      </button>
    </div>
  )
}

function Configuracion() {
  const { puede } = useSesion()
  const [tab, setTab] = useState('tipos')
  const [modal, setModal] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const areas = usePeticion(() => listarAreas(), [])
  const tipos = usePeticion(() => listarTiposDocumentales(), [])
  const entidades = usePeticion(() => listarEntidades(), [])

  const administrable = puede('catalogos:administrar')

  async function ejecutar(accion) {
    setGuardando(true)
    setErrorAccion('')
    try {
      await accion()
      setModal(null)
      return true
    } catch (fallo) {
      setErrorAccion(fallo.message)
      return false
    } finally {
      setGuardando(false)
    }
  }

  /** Guarda el registro del catálogo activo: crea si no hay registro en edición. */
  async function guardar(datos) {
    const { tipo, registro } = modal
    const operaciones = {
      areas: () => (registro ? editarArea(registro.id, datos) : crearArea(datos)),
      tipos: () => (registro ? editarTipoDocumental(registro.id, datos) : crearTipoDocumental(datos)),
      entidades: () => (registro ? editarEntidad(registro.id, datos) : crearEntidad(datos)),
    }
    const guardado = await ejecutar(operaciones[tipo])
    if (!guardado) return
    recargar(tipo)
  }

  /** Desactiva o reactiva: el servicio nunca borra un registro de catálogo. */
  async function cambiarEstado(registro) {
    const tipo = tab
    const reactivar = registro.estado === 'INACTIVO'
    const operaciones = {
      areas: () => (reactivar
        ? editarArea(registro.id, { codigo: registro.codigo, nombre: registro.nombre, responsable: registro.responsable, estado: 'ACTIVO' })
        : desactivarArea(registro.id)),
      tipos: () => (reactivar
        ? editarTipoDocumental(registro.id, { nombre: registro.nombre, prefijo: registro.prefijo, origenes: Array.from(registro.origenes ?? []), estado: 'ACTIVO' })
        : desactivarTipoDocumental(registro.id)),
      entidades: () => (reactivar
        ? editarEntidad(registro.id, { nit: registro.nit, razonSocial: registro.razonSocial, ciudad: registro.ciudad, tipo: registro.tipo, estado: 'ACTIVO' })
        : desactivarEntidad(registro.id)),
    }
    const cambiado = await ejecutar(operaciones[tipo])
    if (cambiado) recargar(tipo)
  }

  function recargar(tipo) {
    if (tipo === 'areas') areas.recargar()
    if (tipo === 'tipos') tipos.recargar()
    if (tipo === 'entidades') entidades.recargar()
  }

  const abrir = (tipo, registro = null) => { setErrorAccion(''); setModal({ tipo, registro }) }

  return (
    <>
      <PageHead
        eyebrow="Configuración y parámetros del sistema"
        title="Parámetros"
        sub="Administra los catálogos que estructuran la radicación: tipos documentales, áreas y entidades."
        actions={administrable ? [
          <button key="n" className="btn" type="button" onClick={() => abrir(tab)}><IconMas size={16} /> Agregar</button>,
        ] : []}
      />

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} type="button" onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {errorAccion ? <div className="error-message mt-16">{errorAccion}</div> : null}

      <div className="mt-16">
        {tab === 'tipos' ? (
          <Card title="Tipos documentales" sub="Clasifican cada radicado" icono={<IconArchivo size={17} />} tight>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Nombre</th><th>Prefijo</th><th>Orígenes permitidos</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                <tbody>
                  {(tipos.datos ?? []).map((tipo) => (
                    <tr key={tipo.id}>
                      <td><strong>{tipo.nombre}</strong><span className="cell-sub">{tipo.id}</span></td>
                      <td><span className="code">{tipo.prefijo ?? '—'}</span></td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {Array.from(tipo.origenes ?? []).map((origen) => (
                            <span className="badge gris" key={origen}>{etiquetaOrigen(origen)}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${estadoBadge[tipo.estado] ?? 'gris'}`}>
                          <span className={`dot ${tipo.estado === 'ACTIVO' ? 'verde' : 'gris'}`} /> {etiquetaEstadoCatalogo(tipo)}
                        </span>
                      </td>
                      <td>
                        <Acciones
                          registro={tipo}
                          administrable={administrable}
                          guardando={guardando}
                          onEditar={(registro) => abrir('tipos', registro)}
                          onCambiarEstado={cambiarEstado}
                        />
                      </td>
                    </tr>
                  ))}
                  {!tipos.datos?.length ? (
                    <tr><td colSpan={5}><div className="empty">{tipos.cargando ? 'Cargando tipos documentales…' : tipos.error || 'Sin tipos documentales.'}</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {tab === 'areas' ? (
          <Card title="Áreas de la organización" sub="Asignan cada documento y usuario al área correspondiente" icono={<IconGlobo size={17} />} tight>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Área</th><th>Responsable</th><th>Usuarios</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                <tbody>
                  {(areas.datos ?? []).map((area) => (
                    <tr key={area.id}>
                      <td><strong>{area.nombre}</strong><span className="cell-sub">{area.codigo ?? area.id}</span></td>
                      <td>{area.responsable ?? '—'}</td>
                      <td><span className="badge azul">{area.usuarios}</span></td>
                      <td>
                        <span className={`badge ${estadoBadge[area.estado] ?? 'gris'}`}>
                          <span className={`dot ${area.estado === 'ACTIVO' ? 'verde' : 'gris'}`} /> {etiquetaEstadoCatalogo(area)}
                        </span>
                      </td>
                      <td>
                        <Acciones
                          registro={area}
                          administrable={administrable}
                          guardando={guardando}
                          onEditar={(registro) => abrir('areas', registro)}
                          onCambiarEstado={cambiarEstado}
                        />
                      </td>
                    </tr>
                  ))}
                  {!areas.datos?.length ? (
                    <tr><td colSpan={5}><div className="empty">{areas.cargando ? 'Cargando áreas…' : areas.error || 'Sin áreas registradas.'}</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {tab === 'entidades' ? (
          <Card
            title="Entidades"
            sub="NIT y razón social requeridos para radicar origen Recibido o generar origen Externo"
            icono={<IconEscudo size={17} />}
            actions={administrable ? <button className="btn secondary sm" type="button" onClick={() => abrir('entidades')}><IconMas size={15} /> Nueva entidad</button> : null}
            tight
          >
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>NIT</th><th>Razón social</th><th>Ciudad</th><th>Tipo</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                <tbody>
                  {(entidades.datos ?? []).map((entidad) => (
                    <tr key={entidad.id}>
                      <td><span className="code">{entidad.nit}</span></td>
                      <td><strong>{entidad.razonSocial}</strong></td>
                      <td>{entidad.ciudad ?? '—'}</td>
                      <td><span className="badge gris">{entidad.tipo ?? '—'}</span></td>
                      <td>
                        <span className={`badge ${estadoBadge[entidad.estado] ?? 'gris'}`}>
                          <span className={`dot ${entidad.estado === 'ACTIVO' ? 'verde' : 'gris'}`} /> {etiquetaEstadoCatalogo(entidad)}
                        </span>
                      </td>
                      <td>
                        <Acciones
                          registro={entidad}
                          administrable={administrable}
                          guardando={guardando}
                          onEditar={(registro) => abrir('entidades', registro)}
                          onCambiarEstado={cambiarEstado}
                        />
                      </td>
                    </tr>
                  ))}
                  {!entidades.datos?.length ? (
                    <tr><td colSpan={6}><div className="empty">{entidades.cargando ? 'Cargando entidades…' : entidades.error || 'Sin entidades registradas.'}</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

      </div>

      <Note icono={<IconConfig size={17} />}>
        Los catálogos permiten <strong>crear, editar y desactivar</strong> registros sin borrar el
        histórico, de modo que los radicados existentes conservan su clasificación original.
      </Note>

      {modal?.tipo === 'areas' ? (
        <FormularioArea registro={modal.registro} guardando={guardando} error={errorAccion} onCerrar={() => setModal(null)} onGuardar={guardar} />
      ) : null}
      {modal?.tipo === 'tipos' ? (
        <FormularioTipo registro={modal.registro} guardando={guardando} error={errorAccion} onCerrar={() => setModal(null)} onGuardar={guardar} />
      ) : null}
      {modal?.tipo === 'entidades' ? (
        <FormularioEntidad registro={modal.registro} guardando={guardando} error={errorAccion} onCerrar={() => setModal(null)} onGuardar={guardar} />
      ) : null}
    </>
  )
}

export default Configuracion
