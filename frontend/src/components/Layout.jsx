import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '../sesion/SesionProvider.jsx'
import {
  IconBandeja, IconBitacora, IconBuscar, IconCampana, IconConfig,
  IconEscudo, IconExpediente, IconFlujo, IconGlobo, IconPlantillas, IconRadicar,
  IconRendimiento, IconResumen, IconRoles, IconSalir, IconTridente, IconUsuarios,
} from './Icons.jsx'

// Las vistas con `permiso` solo se ofrecen si la sesión trae ese permiso (HU-013).
// Las que no lo tienen siguen siendo prototipo y no dependen del servicio.
const grupos = [
  {
    titulo: 'Operación',
    enlaces: [
      { to: '/app', end: true, label: 'Panel', Icono: IconResumen },
      { to: '/app/radicacion', label: 'Radicación', Icono: IconRadicar },
      { to: '/app/radicados', label: 'Consultar radicados', Icono: IconBuscar },
      { to: '/app/bandeja', label: 'Bandeja de tareas', Icono: IconBandeja, count: 5 },
      { to: '/app/expediente', label: 'Expediente central', Icono: IconExpediente },
    ],
  },
  {
    titulo: 'Administración',
    enlaces: [
      { to: '/app/usuarios', label: 'Usuarios', Icono: IconUsuarios, permiso: 'usuarios:consultar' },
      { to: '/app/roles', label: 'Roles y permisos', Icono: IconRoles, permiso: 'roles:consultar' },
      { to: '/app/configuracion', label: 'Parámetros', Icono: IconConfig, permiso: 'catalogos:consultar' },
      { to: '/app/plantillas', label: 'Plantillas', Icono: IconPlantillas },
      { to: '/app/flujos', label: 'Diseñador de flujos', Icono: IconFlujo },
    ],
  },
  {
    titulo: 'Control',
    enlaces: [
      { to: '/app/bitacora', label: 'Bitácora y auditoría', Icono: IconBitacora },
      { to: '/app/rendimiento', label: 'Rendimiento', Icono: IconRendimiento },
    ],
  },
]

const titulos = {
  '/app': ['Panel', 'Resumen general'],
  '/app/radicacion': ['Radicación de documentos', 'Registrar y clasificar'],
  '/app/radicados': ['Consulta y buscador', 'Radicados'],
  '/app/bandeja': ['Bandeja de entrada', 'Tareas pendientes'],
  '/app/expediente': ['Expediente central', 'Archivo institucional'],
  '/app/usuarios': ['Usuarios', 'Administración'],
  '/app/roles': ['Roles y permisos', 'Administración'],
  '/app/configuracion': ['Parámetros del sistema', 'Administración'],
  '/app/plantillas': ['Plantillas', 'Generación de documentos'],
  '/app/flujos': ['Diseñador de flujos', 'Workflow builder'],
  '/app/bitacora': ['Bitácora y auditoría', 'Trazabilidad'],
  '/app/rendimiento': ['Rendimiento', 'Requisitos transversales'],
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
        <Link className="sidebar-brand" to="/">
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
              {g.enlaces.map(({ to, end, label, Icono, count }) => (
                <NavLink key={to} to={to} end={end}>
                  <Icono size={18} />
                  <span>{label}</span>
                  {count ? <span className="nav-count">{count}</span> : null}
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
            <label className="search">
              <IconBuscar size={16} />
              <input placeholder="Buscar radicado, usuario o documento…" aria-label="Buscar" />
            </label>
            <button className="icon-btn" type="button" title="Notificaciones" style={{ position: 'relative' }}>
              <IconCampana size={18} />
              <span className="dot-red" />
            </button>
            <Link to="/" className="icon-btn" title="Índice de mockups">
              <IconGlobo size={18} />
            </Link>
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
