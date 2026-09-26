import { Link } from 'react-router-dom'
import { Card, PageHead, Person, Stat } from '../components/ui.jsx'
import { sesion, resumen } from '../data/mock.js'
import {
  IconArchivo, IconBandeja, IconBitacora, IconBuscar, IconDocumentos, IconFlujo,
  IconInfo, IconRadicar, IconReloj,
} from '../components/Icons.jsx'

const iconos = {
  documentos: <IconDocumentos size={19} />,
  flujo: <IconFlujo size={19} />,
  bandeja: <IconBandeja size={19} />,
  archivo: <IconArchivo size={19} />,
}

function Panel() {
  return (
    <>
      <PageHead
        eyebrow="Panel general"
        title={`Buen día, ${sesion.nombre.split(' ')[0]}`}
        sub={`${sesion.area} · Rol ${sesion.rolPrincipal}. Este es el estado de la operación documental de hoy.`}
        actions={[
          <Link key="r" className="btn" to="/app/radicacion"><IconRadicar size={16} /> Radicar documento</Link>,
          <Link key="b" className="btn secondary" to="/app/bandeja"><IconBandeja size={16} /> Ver bandeja</Link>,
        ]}
      />

      <div className="grid grid-4">
        {resumen.metricas.map((m) => (
          <Stat key={m.label} tono={m.tono} icono={iconos[m.icono]} valor={m.valor} label={m.label} nota={m.nota} />
        ))}
      </div>

      <div className="grid grid-side mt-24">
        <div className="stack">
          <Card title="Documentos por área" sub="Distribución del archivo institucional" icono={<IconArchivo size={17} />}>
            <div className="bars">
              {resumen.porArea.map((a) => (
                <div className="bar-row" key={a.area}>
                  <span className="muted">{a.area}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(a.valor / a.max) * 100}%` }} />
                  </span>
                  <span className="strong nowrap">{a.valor}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Estado de los radicados del mes" icono={<IconDocumentos size={17} />}>
            <div className="grid grid-4">
              {resumen.porEstado.map((e) => (
                <div key={e.estado} className="card pad" style={{ background: 'var(--superficie)' }}>
                  <span className={`badge ${e.tono === 'verde' ? 'verde' : e.tono === 'ambar' ? 'ambar' : e.tono === 'rojo' ? 'rojo' : 'azul'}`}>
                    <span className={`dot ${e.tono}`} /> {e.estado}
                  </span>
                  <div className="stat-value" style={{ fontSize: '1.8rem', marginTop: 12 }}>{e.valor}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Actividad reciente"
            sub="Últimos movimientos registrados"
            icono={<IconBitacora size={17} />}
            actions={<Link className="btn-link" to="/app/bitacora">Ver bitácora completa</Link>}
          >
            <div className="list">
              {resumen.actividad.map((a, i) => (
                <div className="list-row" key={i}>
                  <span className={`dot ${a.accion === 'Rechazado' ? 'rojo' : a.accion === 'Firma aplicada' || a.accion === 'Aprobado' ? 'verde' : 'azul'}`} />
                  <div className="body">
                    <h4>{a.accion}</h4>
                    <p>{a.documento === '—' ? 'Configuración' : a.documento} · {a.usuario}</p>
                  </div>
                  <span className="side muted small">{a.hora}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Accesos rápidos" icono={<IconFlujo size={17} />}>
            <div className="stack" style={{ gap: 8 }}>
              <Link className="btn secondary block" to="/app/radicados"><IconBuscar size={16} /> Consultar radicados</Link>
              <Link className="btn secondary block" to="/app/expediente"><IconArchivo size={16} /> Expediente central</Link>
              <Link className="btn secondary block" to="/app/flujos"><IconFlujo size={16} /> Diseñador de flujos</Link>
              <Link className="btn secondary block" to="/app/usuarios"><IconDocumentos size={16} /> Administrar usuarios</Link>
            </div>
          </Card>

          <Card title="Prioridades de hoy" icono={<IconReloj size={17} />}>
            <div className="list">
              <div className="list-row">
                <span className="dot rojo" />
                <div className="body"><h4>12 tareas vencen hoy</h4><p>4 con semáforo rojo en tu bandeja</p></div>
              </div>
              <div className="list-row">
                <span className="dot ambar" />
                <div className="body"><h4>2 contratos en firma</h4><p>Pendientes de aprobación de Gerencia</p></div>
              </div>
              <div className="list-row">
                <span className="dot azul" />
                <div className="body"><h4>Respaldo programado</h4><p>Próxima copia automática a las 02:00</p></div>
              </div>
            </div>
          </Card>

          <Card title="Sesión activa" icono={<IconInfo size={17} />}>
            <Person nombre={sesion.nombre} detalle={`${sesion.correo} · ${sesion.rolPrincipal}`} />
            <div className="row between mt-16">
              <span className="badge gris">Equipo compartido</span>
              <Link className="btn-link" to="/login">Cerrar sesión</Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

export default Panel
