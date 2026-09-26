import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Bandeja from './pages/Bandeja.jsx'
import Bitacora from './pages/Bitacora.jsx'
import Configuracion from './pages/Configuracion.jsx'
import Expediente from './pages/Expediente.jsx'
import Flujos from './pages/Flujos.jsx'
import Login from './pages/Login.jsx'
import MockIndex from './pages/MockIndex.jsx'
import Panel from './pages/Panel.jsx'
import Plantillas from './pages/Plantillas.jsx'
import Radicacion from './pages/Radicacion.jsx'
import Radicados from './pages/Radicados.jsx'
import Rendimiento from './pages/Rendimiento.jsx'
import Roles from './pages/Roles.jsx'
import Usuarios from './pages/Usuarios.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MockIndex />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<Layout />}>
        <Route index element={<Panel />} />
        <Route path="radicacion" element={<Radicacion />} />
        <Route path="radicados" element={<Radicados />} />
        <Route path="bandeja" element={<Bandeja />} />
        <Route path="expediente" element={<Expediente />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="roles" element={<Roles />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="plantillas" element={<Plantillas />} />
        <Route path="flujos" element={<Flujos />} />
        <Route path="bitacora" element={<Bitacora />} />
        <Route path="rendimiento" element={<Rendimiento />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
