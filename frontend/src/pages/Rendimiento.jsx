import { Card, Note, PageHead, Stat } from '../components/ui.jsx'
import { rendimiento } from '../data/mock.js'
import {
  IconAlerta, IconCheck, IconInfo, IconReloj, IconRendimiento, IconUsuarios,
} from '../components/Icons.jsx'

function Gauge({ valor, meta, ok }) {
  const pct = Math.min(valor / meta, 1)
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="gauge">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} stroke="rgba(255,255,255,0.1)" />
        <circle
          cx="65" cy="65" r={r}
          stroke={ok ? 'var(--exito)' : 'var(--rojo)'}
          strokeDasharray={`${c * pct} ${c}`}
        />
        <text x="65" y="62" textAnchor="middle" fill="#fff" fontSize="20" fontFamily="Space Grotesk" transform="rotate(90 65 65)">{valor.toFixed(2)}s</text>
        <text x="65" y="80" textAnchor="middle" fill="var(--texto-tenue)" fontSize="9" transform="rotate(90 65 65)">meta &lt; {meta}s</text>
      </svg>
    </div>
  )
}

function Rendimiento() {
  return (
    <>
      <PageHead
        eyebrow="Requisitos transversales"
        title="Rendimiento y carga"
        sub="Medición de la carga de la interfaz y de la transición de estados para cumplir el límite de 2 segundos, y pruebas de carga concurrente."
        hu={['HU-084', 'HU-085']}
      />

      <div className="grid grid-4">
        {rendimiento.metricas.map((m) => (
          <Stat
            key={m.label}
            tono={m.tono}
            icono={m.ok ? <IconCheck size={19} /> : <IconAlerta size={19} />}
            valor={m.valor}
            label={m.label}
            nota={`Objetivo: ${m.meta}`}
          />
        ))}
      </div>

      <div className="grid grid-side mt-24">
        <div className="stack">
          <Card title="Carga por vista (LCP)" sub="Todas las vistas por debajo del límite de 2 s" icono={<IconRendimiento size={17} />}>
            <div className="bars">
              {rendimiento.rutas.map((r) => (
                <div className="bar-row" key={r.ruta}>
                  <span className="muted">{r.ruta}</span>
                  <span className="bar-track">
                    <span className={`bar-fill ${r.lcp < 1.2 ? 'verde' : ''}`} style={{ width: `${(r.lcp / r.max) * 100}%` }} />
                  </span>
                  <span className="strong nowrap">{r.lcp.toFixed(2)}s</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Pruebas de carga concurrente" sub="N = 120 usuarios concurrentes mínimos" icono={<IconUsuarios size={17} />} tight>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Escenario</th><th>Latencia p95</th><th>Tasa de error</th><th>Resultado</th></tr></thead>
                <tbody>
                  {rendimiento.carga.map((c) => (
                    <tr key={c.escenario}>
                      <td><strong>{c.escenario}</strong></td>
                      <td>{c.p95}</td>
                      <td>{c.errores}</td>
                      <td>
                        <span className={`badge ${c.p95 <= '1.94 s' ? 'verde' : 'rojo'}`}>
                          <IconCheck size={12} /> Sin degradación
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Note icono={<IconInfo size={17} />}>
            No hay degradación del rendimiento con el número mínimo de usuarios concurrentes
            definido (N = 120): la latencia p95 se mantiene por debajo de la meta.
          </Note>
        </div>

        <div className="stack">
          <Card title="Transición de estados" sub="Meta: menor a 2 segundos" icono={<IconReloj size={17} />}>
            <Gauge valor={0.38} meta={2} ok />
            <div className="row between mt-16">
              <span className="badge verde"><IconCheck size={12} /> Cumple</span>
              <span className="muted small">0.38 s medido</span>
            </div>
          </Card>

          <Card title="Presupuesto de rendimiento" icono={<IconRendimiento size={17} />}>
            <div className="stack" style={{ gap: 12 }}>
              <div className="row between"><span className="muted">Carga inicial (LCP)</span><span className="badge verde">&lt; 2 s</span></div>
              <div className="row between"><span className="muted">Transición de estado</span><span className="badge verde">&lt; 2 s</span></div>
              <div className="row between"><span className="muted">First Input Delay</span><span className="badge verde">&lt; 100 ms</span></div>
              <div className="row between"><span className="muted">Tamaño del bundle inicial</span><span className="badge verde">148 KB gzip</span></div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

export default Rendimiento
