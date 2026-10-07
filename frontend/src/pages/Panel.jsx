import { Link } from 'react-router-dom'
import { Card, KV, PageHead, Person, Stat } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import { listarUsuarios } from '../api/usuarios.js'
import { listarRoles } from '../api/roles.js'
import { listarAreas, listarEntidades, listarTiposDocumentales } from '../api/catalogos.js'
import { useSesion } from '../sesion/SesionProvider.jsx'
import { formatearFecha } from '../util/formato.js'
import {
  IconArchivo, IconConfig, IconDocumentos, IconEscudo, IconInfo, IconRoles, IconUsuarios,
} from '../components/Icons.jsx'

/** Resuelve la consulta solo si la sesión tiene el permiso; si no, la métrica no se muestra. */
function usarMetrica(permitido, consulta, extraer) {
  const { datos, cargando, error } = usePeticion(
    () => (permitido ? consulta().then(extraer) : Promise.resolve(null)),
    [permitido],
  )
  return { valor: datos, cargando, error, visible: permitido }
}

function valorMetrica({ valor, cargando, error }) {
  if (cargando) return '…'
  if (error) return '—'
  return valor ?? 0
}

function Panel() {
  const { sesion, puede } = useSesion()
  const primerNombre = sesion?.nombre?.split(' ')[0] ?? ''

  const usuariosActivos = usarMetrica(
    puede('usuarios:consultar'),
    () => listarUsuarios({ estado: 'ACTIVO', tamano: 1 }),
    (pagina) => pagina.total,
  )
  const roles = usarMetrica(puede('roles:consultar'), listarRoles, (lista) => lista.length)
  const catalogos = puede('catalogos:consultar')
  const areas = usarMetrica(catalogos, () => listarAreas({ soloActivas: true }), (lista) => lista.length)
  const tipos = usarMetrica(catalogos, () => listarTiposDocumentales({ soloActivos: true }), (lista) => lista.length)
  const entidades = usarMetrica(catalogos, () => listarEntidades({ soloActivas: true }), (lista) => lista.length)

  const metricas = [
    { clave: 'usuarios', metrica: usuariosActivos, label: 'Usuarios activos', icono: <IconUsuarios size={19} />, tono: 'azul', to: '/app/usuarios' },
    { clave: 'roles', metrica: roles, label: 'Roles definidos', icono: <IconRoles size={19} />, tono: 'rojo', to: '/app/roles' },
    { clave: 'areas', metrica: areas, label: 'Áreas activas', icono: <IconArchivo size={19} />, tono: 'azul', to: '/app/configuracion' },
    { clave: 'tipos', metrica: tipos, label: 'Tipos documentales activos', icono: <IconDocumentos size={19} />, tono: 'azul', to: '/app/configuracion' },
    { clave: 'entidades', metrica: entidades, label: 'Entidades activas', icono: <IconConfig size={19} />, tono: 'rojo', to: '/app/configuracion' },
  ].filter(({ metrica }) => metrica.visible)

  const accesos = [
    { to: '/app/usuarios', label: 'Administrar usuarios', Icono: IconUsuarios, permiso: 'usuarios:consultar' },
    { to: '/app/roles', label: 'Roles y permisos', Icono: IconRoles, permiso: 'roles:consultar' },
    { to: '/app/configuracion', label: 'Parámetros del sistema', Icono: IconConfig, permiso: 'catalogos:consultar' },
  ].filter(({ permiso }) => puede(permiso))

  return (
    <>
      <PageHead
        eyebrow="Panel general"
        title={primerNombre ? `Buen día, ${primerNombre}` : 'Buen día'}
        sub={`${sesion?.area ?? 'Sin área'} · Rol ${sesion?.rolPrincipal ?? 'sin asignar'}.`}
      />

      {metricas.length ? (
        <div className="grid grid-4">
          {metricas.map(({ clave, metrica, label, icono, tono, to }) => (
            <Link key={clave} to={to} style={{ color: 'inherit' }}>
              <Stat tono={tono} icono={icono} valor={valorMetrica(metrica)} label={label} />
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid grid-side mt-24">
        <div className="stack">
          <Card title="Accesos rápidos" icono={<IconEscudo size={17} />}>
            {accesos.length ? (
              <div className="stack" style={{ gap: 8 }}>
                {accesos.map(({ to, label, Icono }) => (
                  <Link key={to} className="btn secondary block" to={to}><Icono size={16} /> {label}</Link>
                ))}
              </div>
            ) : (
              <p className="muted small">
                Tu rol todavía no tiene permisos sobre los módulos disponibles. Solicita al
                administrador del sistema la asignación de permisos.
              </p>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Sesión activa" icono={<IconInfo size={17} />}>
            {sesion ? (
              <>
                <Person nombre={sesion.nombre} detalle={sesion.correo} />
                <div className="mt-16">
                  <KV items={[
                    { k: 'Área', v: sesion.area ?? '—' },
                    { k: 'Roles', v: sesion.roles?.join(', ') || 'Sin roles' },
                    { k: 'Permisos', v: sesion.permisos?.length ?? 0 },
                    { k: 'Inicio de sesión', v: formatearFecha(sesion.ultimoAcceso) },
                  ]} />
                </div>
              </>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  )
}

export default Panel
