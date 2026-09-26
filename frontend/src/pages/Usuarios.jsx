import { useState } from 'react'
import { Card, Modal, Note, PageHead, Person } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import { listarAreas } from '../api/catalogos.js'
import { listarRoles } from '../api/roles.js'
import {
  asignarRolesUsuario, crearUsuario, darDeBajaUsuario, editarUsuario, listarUsuarios,
} from '../api/usuarios.js'
import { useSesion } from '../sesion/SesionProvider.jsx'
import { etiquetaEstadoUsuario, formatearFecha } from '../util/formato.js'
import {
  IconCheck, IconEditar, IconEscudo, IconFiltro, IconInfo, IconMas, IconPapelera, IconUsuarios,
} from '../components/Icons.jsx'

const TAMANO_PAGINA = 10

const estadoBadge = { ACTIVO: 'verde', INACTIVO: 'gris' }

/** Los roles se pueden editar al crear (HU-003) o al editar si hay permiso (HU-012). */
function puedeEditarRoles(puedoAsignarRoles, usuario) {
  return !usuario || puedoAsignarRoles
}

/** Formulario de alta y edición (HU-003 y HU-004). */
function FormularioUsuario({ usuario, roles, areas, puedoAsignarRoles, guardando, error, onCerrar, onGuardar }) {
  const esEdicion = Boolean(usuario)
  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [correo, setCorreo] = useState(usuario?.correo ?? '')
  const [clave, setClave] = useState('')
  const [areaId, setAreaId] = useState(usuario?.area?.id ?? areas[0]?.id ?? '')
  const [estado, setEstado] = useState(usuario?.estado ?? 'ACTIVO')
  const [rolesSel, setRolesSel] = useState(() => (usuario?.roles ?? []).map((rol) => rol.id))
  const rolesEditables = puedeEditarRoles(puedoAsignarRoles, usuario)

  function alternarRol(id) {
    setRolesSel((actuales) => (actuales.includes(id) ? actuales.filter((rolId) => rolId !== id) : [...actuales, id]))
  }

  function enviar(e) {
    e.preventDefault()
    onGuardar(esEdicion
      ? { nombre, correo, areaId, estado, roles: rolesSel }
      : { nombre, correo, clave, areaId, estado, roles: rolesSel })
  }

  return (
    <Modal
      open
      title={esEdicion ? 'Editar usuario' : 'Nuevo usuario'}
      sub={esEdicion ? usuario.correo : 'Completa los datos para dar acceso al sistema'}
      onClose={onCerrar}
      footer={[
        <button key="c" className="btn secondary" type="button" onClick={onCerrar}>Cancelar</button>,
        <button key="g" className="btn" type="submit" form="form-usuario" disabled={guardando}>
          <IconCheck size={16} /> {guardando ? 'Guardando…' : 'Guardar usuario'}
        </button>,
      ]}
    >
      <form id="form-usuario" className="form-form" onSubmit={enviar}>
        <div className="field-row">
          <div className="field">
            <label>Nombre completo <span className="req">*</span></label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombres y apellidos" />
          </div>
          <div className="field">
            <label>Correo institucional <span className="req">*</span></label>
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@neptuno.gov.co" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Área <span className="req">*</span></label>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>
        </div>
        {!esEdicion ? (
          <div className="field">
            <label>Contraseña inicial <span className="req">*</span></label>
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Entre 10 y 72 caracteres" autoComplete="new-password" />
            <span className="hint">El usuario la usará en su primer ingreso; puede cambiarla después.</span>
          </div>
        ) : null}
        <div className="field">
          <label><IconEscudo size={13} /> Roles asignados <span className="req">*</span></label>
          <div className="grid grid-2">
            {roles.map((rol) => (
              <label key={rol.id} className="switch card pad" style={{ borderRadius: 'var(--r-sm)' }}>
                <input type="checkbox" checked={rolesSel.includes(rol.id)} disabled={!rolesEditables} onChange={() => alternarRol(rol.id)} />
                <span>
                  <strong className="strong">{rol.nombre}</strong>
                  <span className="muted small" style={{ display: 'block' }}>{rol.descripcion}</span>
                </span>
              </label>
            ))}
          </div>
          <span className="hint">
            {rolesEditables
              ? 'Un usuario puede tener uno o varios roles, pero siempre al menos uno.'
              : 'Solo quien tiene el permiso usuarios:asignar-roles puede cambiar los roles (HU-012).'}
          </span>
        </div>
        {error ? <div className="error-message">{error}</div> : null}
      </form>
    </Modal>
  )
}

function Usuarios() {
  const { puede } = useSesion()
  const [fNombre, setFNombre] = useState('')
  const [fRol, setFRol] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [pagina, setPagina] = useState(0)
  const [modal, setModal] = useState(null)
  const [baja, setBaja] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const usuarios = usePeticion(
    () => listarUsuarios({ texto: fNombre || undefined, rolId: fRol || undefined, estado: fEstado || undefined, pagina, tamano: TAMANO_PAGINA }),
    [fNombre, fRol, fEstado, pagina],
  )
  const roles = usePeticion(() => listarRoles(), [])
  const areas = usePeticion(() => listarAreas({ soloActivas: true }), [])

  const lista = usuarios.datos?.contenido ?? []
  const total = usuarios.datos?.total ?? 0
  const totalPaginas = usuarios.datos?.totalPaginas ?? 0

  const puedeCrear = puede('usuarios:crear')
  const puedeEditar = puede('usuarios:editar')
  const puedeEliminar = puede('usuarios:eliminar')
  const puedeAsignarRoles = puede('usuarios:asignar-roles')

  function filtrar(accion) {
    accion()
    setPagina(0)
  }

  async function guardar(datos) {
    setGuardando(true)
    setErrorAccion('')
    try {
      if (modal?.modo === 'editar') {
        const { roles: rolesSel, ...sinRoles } = datos
        await editarUsuario(modal.usuario.id, sinRoles)
        // HU-012 se resuelve con su propio endpoint y solo si hubo cambios.
        const previos = modal.usuario.roles.map((rol) => rol.id).sort().join()
        if (puedeAsignarRoles && rolesSel.slice().sort().join() !== previos) {
          await asignarRolesUsuario(modal.usuario.id, rolesSel)
        }
      } else {
        await crearUsuario({ ...datos, estado: datos.estado ?? 'ACTIVO' })
      }
      setModal(null)
      usuarios.recargar()
    } catch (fallo) {
      setErrorAccion(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarBaja() {
    setGuardando(true)
    setErrorAccion('')
    try {
      await darDeBajaUsuario(baja.id)
      setBaja(null)
      usuarios.recargar()
    } catch (fallo) {
      setErrorAccion(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <PageHead
        eyebrow="Administración de usuarios y roles"
        title="Usuarios"
        sub="Crea, edita y da de baja usuarios, y asígnales uno o varios roles para determinar su nivel de acceso."
        hu={['HU-003', 'HU-004', 'HU-005', 'HU-006', 'HU-012']}
        actions={puedeCrear ? [<button key="n" className="btn" type="button" onClick={() => { setErrorAccion(''); setModal({ modo: 'crear' }) }}><IconMas size={16} /> Nuevo usuario</button>] : []}
      />

      <div className="toolbar">
        <label className="field grow" style={{ maxWidth: 340 }}>
          <input
            type="search"
            placeholder="Buscar por nombre o correo…"
            value={fNombre}
            onChange={(e) => filtrar(() => setFNombre(e.target.value))}
          />
        </label>
        <label className="field" style={{ minWidth: 180 }}>
          <select value={fRol} onChange={(e) => filtrar(() => setFRol(e.target.value))}>
            <option value="">Todos los roles</option>
            {(roles.datos ?? []).map((rol) => <option key={rol.id} value={rol.id}>{rol.nombre}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 150 }}>
          <select value={fEstado} onChange={(e) => filtrar(() => setFEstado(e.target.value))}>
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
          </select>
        </label>
        <span className="badge azul" style={{ marginLeft: 'auto' }}>
          <IconFiltro size={13} /> {lista.length} de {total}
        </span>
      </div>

      {errorAccion ? <div className="error-message mt-16">{errorAccion}</div> : null}

      <Card className="mt-16" tight>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Área</th>
                <th>Roles</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <Person nombre={usuario.nombre} detalle={usuario.correo} />
                  </td>
                  <td>{usuario.area?.nombre ?? '—'}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {(usuario.roles ?? []).map((rol) => <span className="badge azul" key={rol.id}>{rol.nombre}</span>)}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${estadoBadge[usuario.estado] ?? 'gris'}`}>
                      <span className={`dot ${usuario.estado === 'ACTIVO' ? 'verde' : 'gris'}`} /> {etiquetaEstadoUsuario(usuario)}
                    </span>
                  </td>
                  <td className="muted">{formatearFecha(usuario.ultimoAcceso)}</td>
                  <td>
                    <div className="td-actions">
                      {puedeEditar ? (
                        <button className="btn ghost sm" type="button" title="Editar" onClick={() => { setErrorAccion(''); setModal({ modo: 'editar', usuario }) }}>
                          <IconEditar size={15} />
                        </button>
                      ) : null}
                      {puedeEliminar ? (
                        <button className="btn ghost sm" type="button" title="Baja lógica" onClick={() => { setErrorAccion(''); setBaja(usuario) }}>
                          <IconPapelera size={15} />
                        </button>
                      ) : null}
                      {!puedeEditar && !puedeEliminar ? <span className="muted small">Sin permisos</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">
                      {usuarios.cargando ? 'Cargando usuarios…' : usuarios.error || 'No hay usuarios que coincidan con los filtros.'}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 ? (
          <div className="row between mt-16">
            <span className="muted small">Página {pagina + 1} de {totalPaginas}</span>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn secondary sm" type="button" disabled={pagina === 0} onClick={() => setPagina((p) => Math.max(0, p - 1))}>Anterior</button>
              <button className="btn secondary sm" type="button" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
            </div>
          </div>
        ) : null}
      </Card>

      <Note icono={<IconInfo size={17} />}>
        Cada acción de esta vista viaja al servicio de usuarios con el token de la sesión: el
        servicio valida los permisos del rol en cada solicitud (<strong>HU-013</strong>) y la baja
        lógica revoca el acceso sin perder el historial en la bitácora (<strong>HU-014</strong>).
      </Note>

      <Note icono={<IconInfo size={17} />}>
        El servicio rechaza la baja de la propia cuenta y la del último administrador activo, y
        publica cada cambio como evento de auditoría hacia RabbitMQ.
      </Note>

      {modal ? (
        <FormularioUsuario
          usuario={modal.usuario}
          roles={roles.datos ?? []}
          areas={areas.datos ?? []}
          puedoAsignarRoles={puedeAsignarRoles}
          guardando={guardando}
          error={errorAccion}
          onCerrar={() => setModal(null)}
          onGuardar={guardar}
        />
      ) : null}

      <Modal
        open={!!baja}
        title="Dar de baja al usuario"
        sub="Baja lógica: se revoca el acceso pero se conserva el historial"
        onClose={() => setBaja(null)}
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setBaja(null)}>Cancelar</button>,
          <button key="d" className="btn danger" type="button" disabled={guardando} onClick={confirmarBaja}>
            <IconPapelera size={16} /> {guardando ? 'Procesando…' : 'Dar de baja'}
          </button>,
        ]}
      >
        <Note tono="rojo" icono={<IconUsuarios size={17} />}>
          Vas a dar de baja a <strong>{baja?.nombre}</strong>. No podrá iniciar sesión,
          pero sus acciones permanecerán en la bitácora de auditoría.
        </Note>
        {errorAccion ? <div className="error-message mt-16">{errorAccion}</div> : null}
      </Modal>
    </>
  )
}

export default Usuarios
