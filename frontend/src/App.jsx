import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Configuracion from './pages/Configuracion.jsx'
import Login from './pages/Login.jsx'
import Panel from './pages/Panel.jsx'
import Roles from './pages/Roles.jsx'
import Usuarios from './pages/Usuarios.jsx'
import { useSesion } from './sesion/SesionProvider.jsx'

/**
 * Guarda de las páginas privadas: sin sesión vigente se vuelve al login.
 * El token lo emite ms-auth-catalogs y viaja en el JWT de cada solicitud.
 */
function RequiereSesion({ children }) {
  const { sesion } = useSesion()
  const { pathname } = useLocation()

  if (!sesion) return <Navigate to="/login" replace state={{ destino: pathname }} />
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
        <Route path="usuarios" element={<RequierePermiso permiso="usuarios:consultar"><Usuarios /></RequierePermiso>} />
        <Route path="roles" element={<RequierePermiso permiso="roles:consultar"><Roles /></RequierePermiso>} />
        <Route path="configuracion" element={<RequierePermiso permiso="catalogos:consultar"><Configuracion /></RequierePermiso>} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

export default App
