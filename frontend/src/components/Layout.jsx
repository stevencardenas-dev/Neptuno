import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '../sesion/SesionProvider.jsx'
import {
  IconConfig, IconEscudo, IconResumen, IconRoles, IconSalir, IconTridente, IconUsuarios,
} from './Icons.jsx'

// Cada vista con `permiso` solo se ofrece si la sesión trae ese permiso (HU-013).
const grupos = [
  {
    titulo: 'Inicio',
    enlaces: [
      { to: '/app', end: true, label: 'Panel', Icono: IconResumen },
    ],
  },
  {
    titulo: 'Administración',
    enlaces: [
      { to: '/app/usuarios', label: 'Usuarios', Icono: IconUsuarios, permiso: 'usuarios:consultar' },
      { to: '/app/roles', label: 'Roles y permisos', Icono: IconRoles, permiso: 'roles:consultar' },
      { to: '/app/configuracion', label: 'Parámetros', Icono: IconConfig, permiso: 'catalogos:consultar' },
    ],
  },
]

const titulos = {
  '/app': ['Panel', 'Resumen general'],
  '/app/usuarios': ['Usuarios', 'Administración'],
  '/app/roles': ['Roles y permisos', 'Administración'],
  '/app/configuracion': ['Parámetros del sistema', 'Administración'],
}

function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { sesion, cerrar, puede } = useSesion()
  const meta = titulos[pathname] ?? ['Neptuno', 'Gestión documental']

  const visibles = grupos
    .map((grupo) => ({ ...grupo, enlaces: grupo.enlaces.filter((enlace) => !enlace.permiso || puede(enlace.permiso)) }))
    .filter((grupo) => grupo.enlaces.length)

  async function salir() {
    await cerrar()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Navegación principal">
        <Link className="sidebar-brand" to="/app">
          <span className="brand-mark" aria-hidden="true">
            <IconTridente size={24} />
          </span>
          <span className="brand-text">
            <strong>Neptuno</strong>
            <small>Gestión Documental</small>
          </span>
        </Link>

        {visibles.map((g) => (
          <div key={g.titulo}>
            <div className="sidebar-section">{g.titulo}</div>
            <nav className="sidebar-nav">
              {g.enlaces.map(({ to, end, label, Icono }) => (
                <NavLink key={to} to={to} end={end}>
                  <Icono size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        ))}

        <div className="sidebar-user">
          <span className="avatar">{sesion?.iniciales ?? '··'}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>{sesion?.nombre ?? 'Sesión sin datos'}</strong>
            <small title={sesion?.area}>{sesion?.rolPrincipal ?? 'Sin rol'}{sesion?.area ? ` · ${sesion.area}` : ''}</small>
          </div>
          <button className="icon-btn" type="button" title="Cerrar sesión" onClick={salir}>
            <IconSalir size={17} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="crumb">{meta[1]}</div>
            <h2>{meta[0]}</h2>
          </div>
          <div className="topbar-actions">
            <span className="badge rojo" title={`Permisos vigentes: ${sesion?.permisos?.length ?? 0}`}>
              <IconEscudo size={13} /> {sesion?.rolPrincipal ?? 'Sin rol'}
            </span>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
