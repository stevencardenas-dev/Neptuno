import { useMemo, useState } from 'react'
import { Card, Modal, Note, PageHead, Person } from '../components/ui.jsx'
import { areas, roles, usuarios } from '../data/mock.js'
import {
  IconCheck, IconEditar, IconEscudo, IconFiltro, IconInfo, IconMas, IconPapelera, IconUsuarios,
} from '../components/Icons.jsx'

const estadoBadge = { Activo: 'verde', Inactivo: 'gris' }

function Usuarios() {
  const [fNombre, setFNombre] = useState('')
  const [fRol, setFRol] = useState('Todos')
  const [fEstado, setFEstado] = useState('Todos')
  const [modal, setModal] = useState(null) // {modo, usuario}
  const [borrar, setBorrar] = useState(null)

  const filtrados = useMemo(() => usuarios.filter((u) => {
    const okNombre = u.nombre.toLowerCase().includes(fNombre.toLowerCase()) || u.correo.includes(fNombre.toLowerCase())
    const okRol = fRol === 'Todos' || u.roles.includes(fRol)
    const okEstado = fEstado === 'Todos' || u.estado === fEstado
    return okNombre && okRol && okEstado
  }), [fNombre, fRol, fEstado])

  return (
    <>
      <PageHead
        eyebrow="Administración de usuarios y roles"
        title="Usuarios"
        sub="Crea, edita y da de baja usuarios, y asígnales uno o varios roles para determinar su nivel de acceso."
        hu={['HU-003', 'HU-004', 'HU-005', 'HU-006', 'HU-012']}
        actions={[<button key="n" className="btn" type="button" onClick={() => setModal({ modo: 'crear' })}><IconMas size={16} /> Nuevo usuario</button>]}
      />

      <div className="toolbar">
        <label className="field grow" style={{ maxWidth: 340 }}>
          <input type="search" placeholder="Buscar por nombre o correo…" value={fNombre} onChange={(e) => setFNombre(e.target.value)} />
        </label>
        <label className="field" style={{ minWidth: 180 }}>
          <select value={fRol} onChange={(e) => setFRol(e.target.value)}>
            <option value="Todos">Todos los roles</option>
            {roles.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 150 }}>
          <select value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="Todos">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </label>
        <span className="badge azul" style={{ marginLeft: 'auto' }}><IconFiltro size={13} /> {filtrados.length} de {usuarios.length}</span>
      </div>

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
              {filtrados.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Person nombre={u.nombre} detalle={u.correo} />
                  </td>
                  <td>{u.area}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {u.roles.map((r) => <span className="badge azul" key={r}>{r}</span>)}
                    </div>
                  </td>
                  <td><span className={`badge ${estadoBadge[u.estado]}`}><span className={`dot ${u.estado === 'Activo' ? 'verde' : 'gris'}`} /> {u.estado}</span></td>
                  <td className="muted">{u.ultimoAcceso}</td>
                  <td>
                    <div className="td-actions">
                      <button className="btn ghost sm" type="button" title="Editar" onClick={() => setModal({ modo: 'editar', usuario: u })}><IconEditar size={15} /></button>
                      <button className="btn ghost sm" type="button" title="Baja lógica" onClick={() => setBorrar(u)}><IconPapelera size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtrados.length ? (
                <tr><td colSpan={6}><div className="empty">No hay usuarios que coincidan con los filtros.</div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Note icono={<IconInfo size={17} />}>
        El sistema valida en cada solicitud los permisos del rol del usuario (<strong>HU-013</strong>) y
        limita la visibilidad de los documentos según su rol y área (<strong>HU-014</strong>).
        La baja lógica revoca el acceso sin perder el historial en la bitácora.
      </Note>

      <Modal
        open={!!modal}
        title={modal?.modo === 'editar' ? 'Editar usuario' : 'Nuevo usuario'}
        sub={modal?.modo === 'editar' ? modal.usuario.correo : 'Completa los datos para dar acceso al sistema'}
        onClose={() => setModal(null)}
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setModal(null)}>Cancelar</button>,
          <button key="g" className="btn" type="button" onClick={() => setModal(null)}><IconCheck size={16} /> Guardar usuario</button>,
        ]}
      >
        <div className="field-row">
          <div className="field">
            <label>Nombre completo <span className="req">*</span></label>
            <input type="text" defaultValue={modal?.usuario?.nombre ?? ''} placeholder="Nombres y apellidos" />
          </div>
          <div className="field">
            <label>Correo institucional <span className="req">*</span></label>
            <input type="email" defaultValue={modal?.usuario?.correo ?? ''} placeholder="nombre@neptuno.gov.co" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Área <span className="req">*</span></label>
            <select defaultValue={modal?.usuario?.area ?? areas[0].nombre}>
              {areas.map((a) => <option key={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Estado</label>
            <select defaultValue={modal?.usuario?.estado ?? 'Activo'}>
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label><IconEscudo size={13} /> Roles asignados <span className="req">*</span></label>
          <div className="grid grid-2">
            {roles.map((r) => (
              <label key={r.id} className="switch card pad" style={{ borderRadius: 'var(--r-sm)' }}>
                <input type="checkbox" defaultChecked={modal?.usuario?.roles?.includes(r.nombre)} />
                <span>
                  <strong className="strong">{r.nombre}</strong>
                  <span className="muted small" style={{ display: 'block' }}>{r.descripcion}</span>
                </span>
              </label>
            ))}
          </div>
          <span className="hint">Un usuario puede tener uno o varios roles.</span>
        </div>
      </Modal>

      <Modal
        open={!!borrar}
        title="Dar de baja al usuario"
        sub="Baja lógica: se revoca el acceso pero se conserva el historial"
        onClose={() => setBorrar(null)}
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setBorrar(null)}>Cancelar</button>,
          <button key="d" className="btn danger" type="button" onClick={() => setBorrar(null)}><IconPapelera size={16} /> Dar de baja</button>,
        ]}
      >
        <Note tono="rojo" icono={<IconUsuarios size={17} />}>
          Vas a dar de baja a <strong>{borrar?.nombre}</strong>. No podrá iniciar sesión,
          pero sus acciones permanecerán en la bitácora de auditoría.
        </Note>
      </Modal>
    </>
  )
}

export default Usuarios
