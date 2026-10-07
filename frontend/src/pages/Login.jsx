import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  IconCandado, IconEscudo, IconInfo, IconSalir, IconTridente,
} from '../components/Icons.jsx'
import { useSesion } from '../sesion/SesionProvider.jsx'

function Login() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { sesion, iniciar } = useSesion()

  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const destino = state?.destino ?? '/app'

  // Con sesión vigente no tiene sentido volver a autenticarse.
  if (sesion) return <Navigate to={destino} replace />

  async function entrar(e) {
    e.preventDefault()
    if (!correo || !clave) {
      setError('Debes ingresar correo y contraseña para continuar.')
      return
    }
    setEnviando(true)
    setError('')
    try {
      await iniciar(correo, clave)
      navigate(destino, { replace: true })
    } catch (fallo) {
      // El servicio responde 401 con el motivo: credenciales inválidas o cuenta bloqueada.
      setError(fallo.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="auth">
      <aside className="auth-aside">
        <div>
          <span className="brand-mark" aria-hidden="true"><IconTridente size={24} /></span>
          <h1>Gestión documental con control de acceso.</h1>
          <p>
            Neptuno centraliza la radicación, los flujos de aprobación, el expediente
            institucional y la auditoría de cada documento de la organización.
          </p>
          <ul className="auth-features" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li><IconEscudo size={18} /> Acceso restringido según el rol y el área del usuario.</li>
            <li><IconInfo size={18} /> Validación de permisos en cada solicitud.</li>
            <li><IconCandado size={18} /> Bitácora inmutable de todas las acciones.</li>
          </ul>
        </div>
        <span className="badge azul" style={{ width: 'fit-content' }}>
          <IconSalir size={13} /> Cierre de sesión seguro en equipos compartidos
        </span>
      </aside>

      <section className="auth-panel">
        <div className="card pad auth-card">
          <span className="eyebrow">Acceso al sistema</span>
          <div className="row mt-16" style={{ gap: 14 }}>
            <span className="brand-mark" aria-hidden="true"><IconTridente size={26} /></span>
            <div>
              <h2 style={{ fontSize: '1.4rem' }}>Iniciar sesión</h2>
              <p className="muted small">Ingresa con tus credenciales corporativas</p>
            </div>
          </div>

          <form className="form-form" onSubmit={entrar}>
            <div className="field">
              <label htmlFor="correo">Correo institucional</label>
              <input
                id="correo"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="nombre@neptuno.gov.co"
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label htmlFor="clave">Contraseña</label>
              <input
                id="clave"
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button className="btn block" type="submit" disabled={enviando}>
              <IconCandado size={17} /> {enviando ? 'Validando…' : 'Ingresar'}
            </button>
            {error ? <div className="error-message">{error}</div> : null}
          </form>
        </div>
      </section>
    </div>
  )
}

export default Login
