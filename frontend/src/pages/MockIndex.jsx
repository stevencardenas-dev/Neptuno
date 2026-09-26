import { Link } from 'react-router-dom'
import {
  IconBandeja, IconBitacora, IconBuscar, IconConfig, IconDocumentos,
  IconEscudo, IconExpediente, IconFlujo, IconPlantillas, IconRadicar,
  IconRendimiento, IconResumen, IconRoles, IconTridente, IconUsuarios,
} from '../components/Icons.jsx'

const vistas = [
  { to: '/login', titulo: 'Autenticación y acceso', Icono: IconEscudo, desc: 'Inicio y cierre de sesión con acceso según el perfil.', hu: 'HU-001 · HU-002' },
  { to: '/app', titulo: 'Panel general', Icono: IconResumen, desc: 'Resumen de radicados, tránsito y actividad reciente.', hu: '—' },
  { to: '/app/radicacion', titulo: 'Radicación de documentos', Icono: IconRadicar, desc: 'Registro, clasificación por origen, metadatos y anexos.', hu: 'HU-017…041' },
  { to: '/app/radicados', titulo: 'Consulta y buscador', Icono: IconBuscar, desc: 'Listado, filtros y detalle con anexos descargables.', hu: 'HU-020 · HU-023 · HU-028' },
  { to: '/app/bandeja', titulo: 'Bandeja de tareas', Icono: IconBandeja, desc: 'Pendientes por rol/área, semáforo y acciones de flujo.', hu: 'HU-042 · HU-062…075' },
  { to: '/app/expediente', titulo: 'Expediente central', Icono: IconExpediente, desc: 'Vista de árbol por área, subcarpetas y documentos.', hu: 'HU-030…033' },
  { to: '/app/usuarios', titulo: 'Administración de usuarios', Icono: IconUsuarios, desc: 'Crear, editar, baja lógica y filtros del listado.', hu: 'HU-003…006 · HU-012' },
  { to: '/app/roles', titulo: 'Roles y permisos', Icono: IconRoles, desc: 'Catálogo de roles, permisos y usuarios asignados.', hu: 'HU-007…011' },
  { to: '/app/configuracion', titulo: 'Parámetros del sistema', Icono: IconConfig, desc: 'Tipos documentales, áreas, entidades y respaldos.', hu: 'HU-015 · HU-016 · HU-022 · HU-081 · HU-082' },
  { to: '/app/plantillas', titulo: 'Plantillas y renderizado', Icono: IconPlantillas, desc: 'Variables dinámicas, vínculo a orígenes y PDF final.', hu: 'HU-035…038' },
  { to: '/app/flujos', titulo: 'Diseñador de flujos', Icono: IconFlujo, desc: 'Lienzo de estados y transiciones, validación y versiones.', hu: 'HU-048…080' },
  { to: '/app/bitacora', titulo: 'Bitácora y auditoría', Icono: IconBitacora, desc: 'Historial cronológico, filtros y firmas.', hu: 'HU-043…047 · HU-077' },
  { to: '/app/rendimiento', titulo: 'Rendimiento', Icono: IconRendimiento, desc: 'Límite de 2 s y pruebas de carga concurrente.', hu: 'HU-084 · HU-085' },
]

function MockIndex() {
  return (
    <div className="content" style={{ margin: '0 auto' }}>
      <div className="mock-hero">
        <span className="eyebrow">Neptuno · Sistema de Gestión Documental</span>
        <h1>Vistas del sistema para capturas de mockup</h1>
        <p>
          Cada vista de la operación está disponible y navegable con datos de ejemplo
          para tomar su captura. La paleta institucional es azul, rojo y blanco.
        </p>
        <div className="mock-stat-row">
          <div><strong>13</strong><span>Vistas</span></div>
          <div><strong>85</strong><span>Historias de usuario</span></div>
          <div><strong>4</strong><span>Microservicios</span></div>
          <div><strong>1</strong><span>Frontend</span></div>
        </div>
        <div className="row">
          <Link className="btn" to="/app">
            <IconResumen size={17} /> Entrar al panel
          </Link>
          <Link className="btn secondary" to="/login">
            <IconEscudo size={17} /> Ver autenticación
          </Link>
        </div>
      </div>

      <div className="grid grid-3">
        {vistas.map(({ to, titulo, Icono, desc, hu }) => (
          <Link className="mock-card" to={to} key={to}>
            <span className="mock-icon"><Icono size={22} /></span>
            <h3>{titulo}</h3>
            <p>{desc}</p>
            <div className="row between">
              <span className="mock-link">Abrir vista <IconDocumentos size={14} /></span>
              <span className="badge gris">{hu}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="row mt-24" style={{ justifyContent: 'center', color: 'var(--texto-tenue)' }}>
        <IconTridente size={16} /> Neptuno · estructura de microservicios: frontend, usuarios, pagos, inventario y notificaciones
      </div>
    </div>
  )
}

export default MockIndex
