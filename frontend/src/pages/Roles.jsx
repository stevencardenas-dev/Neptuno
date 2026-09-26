import { useEffect, useState } from 'react'
import { Card, KV, Modal, Note, PageHead, Person } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import {
  asignarPermisosRol, catalogoPermisos, crearRol, editarRol, eliminarRol, listarRoles,
  obtenerRol, usuariosDelRol,
} from '../api/roles.js'
import { useSesion } from '../sesion/SesionProvider.jsx'
import { TIPOS_ROL, etiquetaTipoRol } from '../util/formato.js'
import {
  IconCheck, IconEditar, IconEscudo, IconInfo, IconMas, IconPapelera, IconRoles, IconUsuarios,
} from '../components/Icons.jsx'

/** Formulario de alta y edición de roles (HU-007, HU-008). */
function FormularioRol({ rol, tipos, guardando, error, onCerrar, onGuardar }) {
  const esEdicion = Boolean(rol)
  const [nombre, setNombre] = useState(rol?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '')
  const [tipo, setTipo] = useState(rol?.tipo ?? 'OPERATIVO')

  function enviar(e) {
    e.preventDefault()
    onGuardar({ nombre, descripcion, tipo })
  }

  return (
    <Modal
      open
      title={esEdicion ? `Editar rol · ${rol.nombre}` : 'Nuevo rol'}
      sub="Define el nombre, la descripción y el tipo del perfil"
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-rol" disabled={guardando}>
          <IconCheck size={16} /> {guardando ? 'Guardando…' : 'Guardar rol'}
        </button>,
      ]}
    >
      <form id="form-rol" className="form-form" onSubmit={enviar}>
        <div className="field-row">
          <div className="field">
            <label>Nombre del rol <span className="req">*</span></label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Radicador, Tesorero, Gerente" />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {tipos.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Descripción</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="¿Qué puede hacer este perfil?" />
        </div>
        <Note icono={<IconInfo size={17} />}>
          Los permisos se asignan después con <strong>Editar permisos</strong>: el servicio los
          valida en cada solicitud (HU-011, HU-013).
        </Note>
        {error ? <div className="error-message mt-16">{error}</div> : null}
      </form>
    </Modal>
  )
}

function Roles() {
  const { puede } = useSesion()
  const [selId, setSelId] = useState(null)
  const [modal, setModal] = useState(null)
  const [permisosSel, setPermisosSel] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const roles = usePeticion(() => listarRoles(), [])
  const permisos = usePeticion(() => catalogoPermisos(), [])
  const rolActual = selId ?? roles.datos?.[0]?.id ?? null

  const detalle = usePeticion(
    () => (rolActual ? obtenerRol(rolActual) : Promise.resolve(null)),
    [rolActual],
  )
  const asignados = usePeticion(
    () => (rolActual ? usuariosDelRol(rolActual) : Promise.resolve(null)),
    [rolActual],
  )

  const sel = detalle.datos ?? roles.datos?.find((rol) => rol.id === rolActual) ?? null

  // Los permisos marcados siguen al rol seleccionado.
  useEffect(() => {
    setPermisosSel((detalle.datos?.detallePermisos ?? []).map((permiso) => permiso.id))
  }, [detalle.datos])

  const puedeCrear = puede('roles:crear')
  const puedeEditar = puede('roles:editar')
  const puedeEliminar = puede('roles:eliminar')
  const puedeAsignar = puede('roles:asignar-permisos')

  function alternarPermiso(id) {
    setPermisosSel((actuales) => (actuales.includes(id) ? actuales.filter((p) => p !== id) : [...actuales, id]))
  }

  async function ejecutar(accion) {
    setGuardando(true)
    setErrorAccion('')
    try {
      await accion()
      return true
    } catch (fallo) {
      setErrorAccion(fallo.message)
      return false
    } finally {
      setGuardando(false)
    }
  }

  async function guardarRol(datos) {
    const creado = await ejecutar(() => (modal?.rol ? editarRol(modal.rol.id, datos) : crearRol(datos)))
    if (!creado) return
    setModal(null)
    roles.recargar()
    detalle.recargar()
  }

  async function guardarPermisos() {
    const guardado = await ejecutar(() => asignarPermisosRol(rolActual, permisosSel))
    if (!guardado) return
    roles.recargar()
    detalle.recargar()
  }

  async function eliminar() {
    const borrado = await ejecutar(() => eliminarRol(modal.rol.id))
    if (!borrado) return
    setModal(null)
    setSelId(null)
    roles.recargar()
  }

  return (
    <>
      <PageHead
        eyebrow="Administración de usuarios y roles"
        title="Roles y permisos"
        sub="Agrupa permisos por perfil, asígnalos a los usuarios y consulta quién puede hacer qué."
        hu={['HU-007', 'HU-008', 'HU-009', 'HU-010', 'HU-011']}
        actions={puedeCrear ? [<button key="n" className="btn" type="button" onClick={() => { setErrorAccion(''); setModal({ tipo: 'rol' }) }}><IconMas size={16} /> Nuevo rol</button>] : []}
      />

      {errorAccion ? <div className="error-message mt-16">{errorAccion}</div> : null}

      <div className="stack">
        <div className="stack">
          <Card title="Catálogo de roles" sub={`${roles.datos?.length ?? 0} perfiles definidos`} icono={<IconRoles size={17} />} tight>
            <div className="list">
              {(roles.datos ?? []).map((rol) => (
                <div
                  key={rol.id}
                  className="list-row"
                  onClick={() => setSelId(rol.id)}
                  style={rolActual === rol.id ? { borderColor: 'rgba(47,107,255,0.5)', background: 'rgba(47,107,255,0.12)' } : undefined}
                >
                  <span className={`avatar ${rol.tipo === 'APROBADOR' ? 'rojo' : ''}`}>{rol.nombre[0]}</span>
                  <div className="body">
                    <h4>{rol.nombre}</h4>
                    <p>{rol.descripcion ?? 'Sin descripción'}</p>
                  </div>
                  <div className="side">
                    <span className="badge gris" title="Permisos asignados">{rol.permisos} permisos</span>
                    <span className="badge azul" title="Usuarios asignados">{rol.usuarios} usuarios</span>
                  </div>
                </div>
              ))}
              {!roles.datos?.length ? (
                <div className="empty">{roles.cargando ? 'Cargando roles…' : roles.error || 'El servicio no reportó roles.'}</div>
              ) : null}
            </div>
          </Card>

          {sel ? (
            <Card
              title={`Permisos del rol ${sel.nombre}`}
              sub="Marca las funcionalidades que puede ejecutar este perfil"
              icono={<IconEscudo size={17} />}
              actions={puedeAsignar ? (
                <button className="btn sm" type="button" disabled={guardando} onClick={guardarPermisos}>
                  <IconCheck size={15} /> {guardando ? 'Guardando…' : 'Guardar permisos'}
                </button>
              ) : null}
            >
              <div className="grid grid-4">
                {(permisos.datos ?? []).map((grupo) => (
                  <div key={grupo.modulo} className="card pad" style={{ background: 'var(--superficie)' }}>
                    <span className="eyebrow">{grupo.modulo}</span>
                    <div className="stack mt-16" style={{ gap: 10 }}>
                      {grupo.permisos.map((permiso) => (
                        <label key={permiso.id} className="switch" title={permiso.descripcion ?? permiso.codigo}>
                          <input
                            type="checkbox"
                            checked={permisosSel.includes(permiso.id)}
                            disabled={!puedeAsignar}
                            onChange={() => alternarPermiso(permiso.id)}
                          />
                          {permiso.nombre}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {!permisos.datos?.length ? (
                  <div className="empty">{permisos.cargando ? 'Cargando permisos…' : permisos.error || 'Sin catálogo de permisos.'}</div>
                ) : null}
              </div>
              <span className="hint mt-16">
                {permisosSel.length} permisos seleccionados · el JWT de cada usuario viaja con los permisos de sus roles.
              </span>
            </Card>
          ) : null}
        </div>

        <div className="grid grid-3">
          <Card title="Resumen del rol" icono={<IconRoles size={17} />}>
            <KV items={[
              { k: 'Nombre', v: sel?.nombre ?? '—' },
              { k: 'Tipo', v: sel ? etiquetaTipoRol(sel) : '—' },
              { k: 'Permisos', v: `${sel?.permisos ?? 0}` },
              { k: 'Usuarios asignados', v: `${sel?.usuarios ?? 0}` },
            ]} />
            <div className="row mt-16">
              {puedeEditar ? (
                <button className="btn secondary sm" type="button" onClick={() => { setErrorAccion(''); setModal({ tipo: 'rol', rol: sel }) }}>
                  <IconEditar size={15} /> Editar
                </button>
              ) : null}
              {puedeEliminar ? (
                <button
                  className="btn danger sm"
                  type="button"
                  disabled={!sel || sel.usuarios > 0}
                  title={sel?.usuarios > 0 ? 'No se puede eliminar: tiene usuarios asignados' : 'Eliminar'}
                  onClick={() => { setErrorAccion(''); setModal({ tipo: 'eliminar', rol: sel }) }}
                >
                  <IconPapelera size={15} /> Eliminar
                </button>
              ) : null}
            </div>
            {sel?.usuarios > 0 ? <p className="hint mt-8">Solo se puede eliminar un rol sin usuarios asignados (HU-009).</p> : null}
            {sel?.tipo === 'SISTEMA' ? <p className="hint mt-8">Los roles de sistema no se renombran ni se eliminan.</p> : null}
          </Card>

          <Card title="Usuarios con este rol" sub="Quién tiene este nivel de acceso" icono={<IconUsuarios size={17} />}>
            {asignados.datos?.length ? (
              <div className="stack" style={{ gap: 12 }}>
                {asignados.datos.map((usuario) => (
                  <Person key={usuario.id} nombre={usuario.nombre} detalle={`${usuario.area ?? 'Sin área'} · ${usuario.estado}`} />
                ))}
              </div>
            ) : <div className="empty">{asignados.cargando ? 'Cargando usuarios…' : 'Ningún usuario tiene este rol.'}</div>}
          </Card>

          <Note icono={<IconInfo size={17} />}>
            Los roles y permisos viven en <strong>auth_catalogs_db</strong>: este frontend los
            consulta y modifica por el API, así que cualquier cambio se refleja en el servicio y
            queda registrado en la bitácora de auditoría.
          </Note>
        </div>
      </div>

      {modal?.tipo === 'rol' ? (
        <FormularioRol
          rol={modal.rol}
          tipos={TIPOS_ROL}
          guardando={guardando}
          error={errorAccion}
          onCerrar={() => setModal(null)}
          onGuardar={guardarRol}
        />
      ) : null}

      <Modal
        open={modal?.tipo === 'eliminar'}
        title="Eliminar rol"
        sub="El rol se borra del catálogo de perfiles"
        onClose={() => setModal(null)}
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setModal(null)}>Cancelar</button>,
          <button key="e" className="btn danger" type="button" disabled={guardando} onClick={eliminar}>
            <IconPapelera size={16} /> {guardando ? 'Eliminando…' : 'Eliminar rol'}
          </button>,
        ]}
      >
        <Note tono="rojo" icono={<IconEscudo size={17} />}>
          Vas a eliminar el rol <strong>{modal?.rol?.nombre}</strong>. Solo es posible si no tiene
          usuarios asignados; la acción queda en la bitácora de auditoría.
        </Note>
      </Modal>
    </>
  )
}

export default Roles
