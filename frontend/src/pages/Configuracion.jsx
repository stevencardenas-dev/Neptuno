import { useState } from 'react'
import { Card, Modal, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import {
  crearArea, crearEntidad, crearTipoDocumental, desactivarArea, desactivarEntidad,
  desactivarTipoDocumental, editarArea, editarEntidad, editarTipoDocumental,
  listarAreas, listarEntidades, listarTiposDocumentales,
} from '../api/catalogos.js'
import { respaldos } from '../data/mock.js'
import { useSesion } from '../sesion/SesionProvider.jsx'
import { ORIGENES, etiquetaEstadoCatalogo, etiquetaOrigen } from '../util/formato.js'
import {
  IconArchivo, IconCalendario, IconCheck, IconConfig, IconEditar, IconGlobo,
  IconInfo, IconMas, IconPapelera, IconDescargar, IconGuardar, IconEscudo,
  IconSubir, IconReloj,
} from '../components/Icons.jsx'

const tabs = [
  { id: 'tipos', label: 'Tipos documentales' },
  { id: 'areas', label: 'Áreas' },
  { id: 'entidades', label: 'Entidades' },
  { id: 'respaldos', label: 'Copias de seguridad' },
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
            <label>Código</label>
            <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. PLAN" />
          </div>
          <div className="field">
            <label>Nombre del área <span className="req">*</span></label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Planeación" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Responsable</label>
            <input type="text" value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre del responsable" />
          </div>
          <div className="field">
            <label>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
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
            <label>Nombre <span className="req">*</span></label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Orden de servicio" />
          </div>
          <div className="field">
            <label>Prefijo</label>
            <input type="text" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} placeholder="OS" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Orígenes permitidos <span className="req">*</span></label>
          <div className="row">
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
            <label>NIT <span className="req">*</span></label>
            <input type="text" value={nit} onChange={(e) => setNit(e.target.value)} placeholder="900.000.000-0" />
          </div>
          <div className="field">
            <label>Razón social <span className="req">*</span></label>
            <input type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} placeholder="Nombre de la entidad" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Ciudad</label>
            <input type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Bogotá" />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option>Proveedor</option><option>Entidad pública</option><option>Cliente</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
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
        sub="Administra los catálogos que estructuran la radicación: tipos documentales, áreas, entidades y copias de seguridad."
        hu={['HU-015', 'HU-016', 'HU-022', 'HU-081', 'HU-082']}
        actions={administrable && tab !== 'respaldos' ? [
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

        {tab === 'respaldos' ? (
          <div className="grid grid-side">
            <Card title="Historial de copias de seguridad" sub="Documentos y bitácora" icono={<IconArchivo size={17} />} tight>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Identificador</th><th>Tipo</th><th>Tamaño</th><th>Contenido</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                  <tbody>
                    {respaldos.map((b) => (
                      <tr key={b.id}>
                        <td><strong>{b.id}</strong><span className="cell-sub">{b.fecha}</span></td>
                        <td><span className="badge gris">{b.tipo}</span></td>
                        <td>{b.tamano}</td>
                        <td className="muted small">{b.documentos} documentos · {b.bitacora}</td>
                        <td><span className={`badge ${b.estado === 'Completado' ? 'verde' : 'ambar'}`}><span className={`dot ${b.estado === 'Completado' ? 'verde' : 'ambar'}`} /> {b.estado}</span></td>
                        <td><div className="td-actions">
                          <button className="btn ghost sm" type="button" title="Restaurar"><IconSubir size={15} /></button>
                          <button className="btn ghost sm" type="button" title="Descargar"><IconDescargar size={15} /></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Note icono={<IconInfo size={17} />}>
                Vista de prototipo: la copia de seguridad y la restauración (HU-081, HU-082) todavía
                no tienen servicio; el contenido es de ejemplo.
              </Note>
            </Card>

            <div className="stack">
              <Card title="Programación" sub="Copias automáticas" icono={<IconCalendario size={17} />}>
                <div className="field">
                  <label>Frecuencia</label>
                  <select defaultValue="Diaria"><option>Diaria</option><option>Cada 12 horas</option><option>Semanal</option></select>
                </div>
                <div className="field-row mt-16">
                  <div className="field"><label>Hora</label><input type="text" defaultValue="02:00" /></div>
                  <div className="field"><label>Retención</label><input type="text" defaultValue="30 días" /></div>
                </div>
                <label className="switch mt-16"><input type="checkbox" defaultChecked /> Incluir bitácora de auditoría</label>
                <button className="btn block mt-16" type="button"><IconGuardar size={16} /> Guardar programación</button>
              </Card>

              <Card title="Restaurar" sub="Recupera documentos y bitácora" icono={<IconSubir size={17} />}>
                <Note icono={<IconInfo size={17} />}>
                  La restauración reemplaza el contenido actual por el de la copia seleccionada.
                  Se registra en la bitácora y requiere confirmación.
                </Note>
                <div className="field mt-16">
                  <label>Copia a restaurar</label>
                  <select>{respaldos.map((b) => <option key={b.id}>{b.id} · {b.fecha}</option>)}</select>
                </div>
                <button className="btn danger block mt-16" type="button"><IconReloj size={16} /> Restaurar copia</button>
              </Card>
            </div>
          </div>
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
