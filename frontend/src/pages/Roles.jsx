import { useState } from 'react'
import { Card, KV, Modal, Note, PageHead, Person } from '../components/ui.jsx'
import { permisosCatalogo, roles, usuarios } from '../data/mock.js'
import {
  IconCheck, IconEditar, IconEscudo, IconInfo, IconMas, IconPapelera, IconRoles, IconUsuarios,
} from '../components/Icons.jsx'

function Roles() {
  const [sel, setSel] = useState(roles[1])
  const [modal, setModal] = useState(null)

  const asignados = usuarios.filter((u) => u.roles.includes(sel.nombre))

  return (
    <>
      <PageHead
        eyebrow="Administración de usuarios y roles"
        title="Roles y permisos"
        sub="Agrupa permisos por perfil, asígnalos a los usuarios y consulta quién puede hacer qué."
        hu={['HU-007', 'HU-008', 'HU-009', 'HU-010', 'HU-011']}
        actions={[<button key="n" className="btn" type="button" onClick={() => setModal('crear-rol')}><IconMas size={16} /> Nuevo rol</button>]}
      />

      <div className="stack">
        <div className="stack">
          <Card title="Catálogo de roles" sub={`${roles.length} perfiles definidos`} icono={<IconRoles size={17} />} tight>
            <div className="list">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="list-row"
                  onClick={() => setSel(r)}
                  style={sel.id === r.id ? { borderColor: 'rgba(47,107,255,0.5)', background: 'rgba(47,107,255,0.12)' } : undefined}
                >
                  <span className={`avatar ${r.tipo === 'Aprobador' ? 'rojo' : ''}`}>{r.nombre[0]}</span>
                  <div className="body">
                    <h4>{r.nombre}</h4>
                    <p>{r.descripcion}</p>
                  </div>
                  <div className="side">
                    <span className="badge gris" title="Permisos asignados">{r.permisos} permisos</span>
                    <span className="badge azul" title="Usuarios asignados">{r.usuarios} usuarios</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title={`Permisos del rol ${sel.nombre}`}
            sub="Marca las funcionalidades que puede ejecutar este perfil"
            icono={<IconEscudo size={17} />}
            actions={<button className="btn sm" type="button" onClick={() => setModal('permisos')}><IconEditar size={15} /> Editar permisos</button>}
          >
            <div className="grid grid-4">
              {permisosCatalogo.map((grupo) => (
                <div key={grupo.modulo} className="card pad" style={{ background: 'var(--superficie)' }}>
                  <span className="eyebrow">{grupo.modulo}</span>
                  <div className="stack mt-16" style={{ gap: 10 }}>
                    {grupo.items.map((p) => (
                      <label key={p.nombre} className="switch">
                        <input type="checkbox" defaultChecked={sel.nombre === 'Administrador' ? true : p.activo} />
                        {p.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-3">
          <Card title="Resumen del rol" icono={<IconRoles size={17} />}>
            <KV items={[
              { k: 'Nombre', v: sel.nombre },
              { k: 'Tipo', v: sel.tipo },
              { k: 'Permisos', v: `${sel.permisos}` },
              { k: 'Usuarios asignados', v: `${sel.usuarios}` },
            ]} />
            <div className="row mt-16">
              <button className="btn secondary sm" type="button"><IconEditar size={15} /> Editar</button>
              <button className="btn danger sm" type="button" disabled={sel.usuarios > 0} title={sel.usuarios > 0 ? 'No se puede eliminar: tiene usuarios asignados' : 'Eliminar'}>
                <IconPapelera size={15} /> Eliminar
              </button>
            </div>
            {sel.usuarios > 0 ? <p className="hint mt-8">Solo se puede eliminar un rol sin usuarios asignados.</p> : null}
          </Card>

          <Card title="Usuarios con este rol" sub="Quién tiene este nivel de acceso" icono={<IconUsuarios size={17} />}>
            {asignados.length ? (
              <div className="stack" style={{ gap: 12 }}>
                {asignados.map((u) => <Person key={u.id} nombre={u.nombre} detalle={`${u.area} · ${u.estado}`} />)}
              </div>
            ) : <div className="empty">Ningún usuario tiene este rol.</div>}
          </Card>

          <Note icono={<IconInfo size={17} />}>
            El sistema <strong>valida los permisos</strong> del rol en cada solicitud (HU-013) e
            <strong> impide</strong> eliminar roles con usuarios asignados (HU-009).
          </Note>
        </div>
      </div>

      <Modal
        open={!!modal}
        title={modal === 'permisos' ? `Editar permisos · ${sel.nombre}` : 'Nuevo rol'}
        sub="Define el nombre, la descripción y los permisos del perfil"
        onClose={() => setModal(null)}
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setModal(null)}>Cancelar</button>,
          <button key="g" className="btn" type="button" onClick={() => setModal(null)}><IconCheck size={16} /> Guardar rol</button>,
        ]}
      >
        <div className="field-row">
          <div className="field">
            <label>Nombre del rol <span className="req">*</span></label>
            <input type="text" defaultValue={modal === 'permisos' ? sel.nombre : ''} placeholder="Ej. Radicador, Tesorero, Gerente" />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select defaultValue={sel.tipo}>
              <option>Operativo</option><option>Aprobador</option><option>Control</option><option>Sistema</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Descripción</label>
          <textarea defaultValue={modal === 'permisos' ? sel.descripcion : ''} placeholder="¿Qué puede hacer este perfil?" />
        </div>
        <div className="field">
          <label><IconEscudo size={13} /> Permisos sobre funcionalidades</label>
          <div className="grid grid-2">
            {permisosCatalogo.map((g) => (
              <div key={g.modulo} className="card pad" style={{ background: 'var(--superficie)' }}>
                <span className="muted small strong">{g.modulo}</span>
                <div className="stack mt-8" style={{ gap: 8 }}>
                  {g.items.map((p) => (
                    <label key={p.nombre} className="switch"><input type="checkbox" defaultChecked={p.activo} /> {p.nombre}</label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  )
}

export default Roles
