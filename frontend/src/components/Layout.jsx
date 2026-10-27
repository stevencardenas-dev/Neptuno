import { useState } from 'react'
import { alternarTema, temaActual } from '../util/tema.js'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '../sesion/SesionProvider.jsx'
import {
  IconBandeja, IconConfig, IconDocumentos, IconEscudo, IconFlujo, IconResumen, IconRoles, IconSalir, IconTridente, IconUsuarios,
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
    titulo: 'Radicación',
    enlaces: [
      { to: '/app/radicacion', label: 'Radicados', Icono: IconDocumentos, permiso: 'radicados:consultar' },
    ],
  },
  {
    titulo: 'Flujo de trabajo',
    enlaces: [
      { to: '/app/bandeja', label: 'Bandeja', Icono: IconBandeja, permiso: 'flujo:aprobar' },
      { to: '/app/flujos', label: 'Flujos', Icono: IconFlujo, permiso: 'flujos:administrar' },
    ],
  },
  {
    titulo: 'Auditoría',
    enlaces: [
      { to: '/app/bitacora', label: 'Bitácora', Icono: IconEscudo, permiso: 'bitacora:consultar' },
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

// Sección a la que pertenece cada ruta. La barra superior solo ubica al usuario y
// coincide con los grupos del menú; el título de la página lo pone el cuerpo de la
// vista, para no decir lo mismo dos veces en 60 px de alto.
const secciones = {
  '/app': 'Inicio',
  '/app/radicacion': 'Radicación',
  '/app/flujos': 'Flujo de trabajo',
  '/app/bandeja': 'Flujo de trabajo',
  '/app/bitacora': 'Auditoría',
  '/app/usuarios': 'Administración',
  '/app/roles': 'Administración',
  '/app/configuracion': 'Administración',
}

function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { sesion, cerrar, puede } = useSesion()
  const [tema, setTema] = useState(temaActual)
  const seccion = Object.entries(secciones)
    .filter(([ruta]) => pathname === ruta || pathname.startsWith(`${ruta}/`))
    .sort(([uno], [otro]) => otro.length - uno.length)[0]?.[1] ?? 'Gestión documental'

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
            <IconTridente size={20} />
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

        <div className="sidebar-pie">
          <button className="sidebar-salir" type="button" onClick={salir}>
            <IconSalir size={18} />
            <span>Cerrar sesión</span>
          </button>

          <div className="sidebar-user">
            <span className="avatar">{sesion?.iniciales ?? '··'}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong title={sesion?.nombre}>{sesion?.nombre ?? 'Sesión sin datos'}</strong>
              <small title={[sesion?.rolPrincipal, sesion?.area].filter(Boolean).join(' · ')}>
                {sesion?.area ?? sesion?.rolPrincipal ?? 'Sin datos'}
              </small>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb">{seccion}</div>
          <div className="topbar-actions">
            <button type="button" className="tema-toggle" onClick={() => setTema(alternarTema())}
              title={tema === 'oscuro' ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
              aria-label={tema === 'oscuro' ? 'Cambiar a modo día' : 'Cambiar a modo noche'}>
              {tema === 'oscuro' ? '☀' : '☾'}
            </button>
            <span className="badge gris" title={`Permisos vigentes: ${sesion?.permisos?.length ?? 0}`}>
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
