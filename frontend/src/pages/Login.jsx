import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  IconCandado, IconEscudo, IconInfo, IconOjo, IconOjoTachado, IconTridente,
} from '../components/Icons.jsx'
import { useSesion } from '../sesion/SesionProvider.jsx'

function Login() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { sesion, iniciar } = useSesion()

  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [bloqMayus, setBloqMayus] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const destino = state?.destino ?? '/app'
  const sesionCaducada = state?.motivo === 'expirada'

  // Con sesión vigente no tiene sentido volver a autenticarse.
  if (sesion) return <Navigate to={destino} replace />

  // El campo de contraseña no avisa si Bloq Mayús está activo: sin esto, un error
  // de mayúsculas le llega al usuario como "credenciales inválidas" y sin pista.
  function revisarBloqMayus(evento) {
    if (typeof evento.getModifierState === 'function') {
      setBloqMayus(evento.getModifierState('CapsLock'))
    }
  }

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
      <section className="auth-panel">
        <div className="card auth-card">
          <div className="auth-marca">
            <span className="brand-mark" aria-hidden="true"><IconTridente size={22} /></span>
            <div>
              <strong>Neptuno</strong>
              <small>Gestión documental</small>
            </div>
          </div>

          <h1>Iniciar sesión</h1>
          <p className="auth-ayuda">Ingresa con tus credenciales institucionales.</p>

          {sesionCaducada ? (
            <div className="aviso" role="status">
              <IconInfo size={15} />
              <span>Tu sesión caducó por seguridad. Vuelve a ingresar para continuar.</span>
            </div>
          ) : null}

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
                autoFocus
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? 'error-login' : undefined}
              />
            </div>
            <div className="field">
              <label htmlFor="clave">Contraseña</label>
              <div className="campo-clave">
                <input
                  id="clave"
                  type={verClave ? 'text' : 'password'}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={error ? 'error-login' : undefined}
                  onKeyUp={revisarBloqMayus}
                  onKeyDown={revisarBloqMayus}
                  onBlur={() => setBloqMayus(false)}
                />
                <button
                  type="button"
                  className="btn-ojo"
                  onClick={() => setVerClave((visible) => !visible)}
                  aria-label={verClave ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                  aria-pressed={verClave}
                  title={verClave ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                >
                  {verClave ? <IconOjoTachado size={17} /> : <IconOjo size={17} />}
                </button>
              </div>
              {bloqMayus ? <p className="aviso-tecla">Tienes Bloq Mayús activado.</p> : null}
            </div>
            <button className="btn block" type="submit" disabled={enviando}>
              <IconCandado size={17} /> {enviando ? 'Validando…' : 'Ingresar'}
            </button>
            {error ? (
              <div className="error-message" id="error-login" role="alert">{error}</div>
            ) : null}
          </form>

          <p className="auth-pie">
            <IconEscudo size={13} /> El acceso y cada acción quedan en la bitácora.
          </p>
        </div>
      </section>
    </div>
  )
}

export default Login
