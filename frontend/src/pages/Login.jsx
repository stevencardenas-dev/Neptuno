import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconCandado, IconEscudo, IconInfo, IconSalir, IconTridente,
} from '../components/Icons.jsx'

function Login() {
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('laura.restrepo@neptuno.gov.co')
  const [clave, setClave] = useState('••••••••••')
  const [error, setError] = useState('')

  function entrar(e) {
    e.preventDefault()
    if (!correo || !clave) {
      setError('Debes ingresar correo y contraseña para continuar.')
      return
    }
    navigate('/app')
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
              />
            </div>
            <div className="row between">
              <label className="switch">
                <input type="checkbox" defaultChecked /> Mantener sesión
              </label>
              <a className="btn-link" href="#recuperar" onClick={(e) => e.preventDefault()}>¿Olvidaste tu contraseña?</a>
            </div>
            <button className="btn block" type="submit">
              <IconCandado size={17} /> Ingresar
            </button>
            {error ? <div className="error-message">{error}</div> : null}
          </form>

          <p className="form-note">
            <IconInfo size={15} />
            Mockup demostrativo: cualquier credencial abre el panel, que respeta
            únicamente lo que permite tu perfil.
          </p>
          <div className="divider mt-16" />
          <p className="muted small mt-16">
            <Link className="btn-link" to="/">Ver índice de mockups</Link>
          </p>
        </div>
      </section>
    </div>
  )
}

export default Login
