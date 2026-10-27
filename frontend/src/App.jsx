import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Bitacora from './pages/Bitacora.jsx'
import Bandeja from './pages/Bandeja.jsx'
import Configuracion from './pages/Configuracion.jsx'
import DisenadorFlujo from './pages/DisenadorFlujo.jsx'
import Flujos from './pages/Flujos.jsx'
import Login from './pages/Login.jsx'
import Panel from './pages/Panel.jsx'
import Radicacion from './pages/Radicacion.jsx'
import Roles from './pages/Roles.jsx'
import Usuarios from './pages/Usuarios.jsx'
import { useSesion } from './sesion/SesionProvider.jsx'

/**
 * Guarda de las páginas privadas: sin sesión vigente se vuelve al login.
 * El token lo emite ms-auth-catalogs y viaja en el JWT de cada solicitud.
 */
function RequiereSesion({ children }) {
  const { sesion, perdida } = useSesion()
  const { pathname } = useLocation()

  // `motivo` viaja solo cuando la sesión se cayó sola (el refresco falló), para
  // que el login pueda explicar por qué apareció en vez de mudarse en silencio.
  if (!sesion) {
    return <Navigate to="/login" replace state={{ destino: pathname, motivo: perdida ? 'expirada' : undefined }} />
  }
  return children
}

/**
 * Guarda por permiso (HU-013): aunque el menú ya oculta la vista, una URL escrita
 * a mano no debe mostrar una página cuyo API va a responder 403.
 */
function RequierePermiso({ permiso, children }) {
  const { puede } = useSesion()
  return puede(permiso) ? children : <Navigate to="/app" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<RequiereSesion><Layout /></RequiereSesion>}>
        <Route index element={<Panel />} />
        <Route path="radicacion" element={<RequierePermiso permiso="radicados:consultar"><Radicacion /></RequierePermiso>} />
        <Route path="bandeja" element={<RequierePermiso permiso="flujo:aprobar"><Bandeja /></RequierePermiso>} />
        <Route path="flujos" element={<RequierePermiso permiso="flujos:administrar"><Flujos /></RequierePermiso>} />
        <Route path="flujos/:id" element={<RequierePermiso permiso="flujos:administrar"><DisenadorFlujo /></RequierePermiso>} />
        <Route path="usuarios" element={<RequierePermiso permiso="usuarios:consultar"><Usuarios /></RequierePermiso>} />
        <Route path="roles" element={<RequierePermiso permiso="roles:consultar"><Roles /></RequierePermiso>} />
        <Route path="configuracion" element={<RequierePermiso permiso="catalogos:consultar"><Configuracion /></RequierePermiso>} />
        <Route path="bitacora" element={<RequierePermiso permiso="bitacora:consultar"><Bitacora /></RequierePermiso>} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

export default App
