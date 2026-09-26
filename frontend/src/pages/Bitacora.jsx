import { useMemo, useState } from 'react'
import { Card, Note, PageHead, Person } from '../components/ui.jsx'
import { accionesBitacora, bitacora, radicadoDetalle } from '../data/mock.js'
import {
  IconBitacora, IconCandado, IconEscudo, IconFiltro, IconFirma, IconInfo, IconReloj, IconDescargar,
} from '../components/Icons.jsx'

function Bitacora() {
  const [fUsuario, setFUsuario] = useState('Todos')
  const [fAccion, setFAccion] = useState('Todas')
  const [desde, setDesde] = useState('2026-09-18')
  const [hasta, setHasta] = useState('2026-09-25')

  const usuarios = useMemo(() => [...new Set(bitacora.map((b) => b.usuario))], [])

  const filtrada = bitacora.filter((b) => {
    const okU = fUsuario === 'Todos' || b.usuario === fUsuario
    const okA = fAccion === 'Todas' || b.accion === fAccion
    const okF = b.fecha.slice(0, 10) >= desde && b.fecha.slice(0, 10) <= hasta
    return okU && okA && okF
  })

  return (
    <>
      <PageHead
        eyebrow="Bitácora y auditoría"
        title="Bitácora"
        sub="Cada acción sobre un documento queda registrada de forma inmutable: quién, qué y cuándo, garantizando la trazabilidad completa."
        hu={['HU-043', 'HU-044', 'HU-045', 'HU-046', 'HU-047', 'HU-077']}
        actions={[<button key="e" className="btn secondary" type="button"><IconDescargar size={16} /> Exportar bitácora</button>]}
      />

      <div className="toolbar">
        <label className="field" style={{ minWidth: 200 }}>
          <select value={fUsuario} onChange={(e) => setFUsuario(e.target.value)}>
            <option>Todos</option>{usuarios.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 180 }}>
          <select value={fAccion} onChange={(e) => setFAccion(e.target.value)}>
            {accionesBitacora.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="field"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" /></label>
        <label className="field"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" /></label>
        <span className="badge azul" style={{ marginLeft: 'auto' }}><IconFiltro size={13} /> {filtrada.length} registros</span>
      </div>

      <div className="grid grid-side mt-16">
        <Card title="Registros de auditoría" sub="Orden cronológico descendente · solo lectura" icono={<IconBitacora size={17} />} tight>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Documento</th><th>Detalle</th></tr>
              </thead>
              <tbody>
                {filtrada.map((b, i) => (
                  <tr key={i}>
                    <td className="nowrap muted">{b.fecha}</td>
                    <td><strong>{b.usuario}</strong><span className="cell-sub">{b.area}</span></td>
                    <td><span className={`badge ${b.tono === 'rojo' ? 'rojo' : b.tono === 'verde' ? 'verde' : b.tono === 'ambar' ? 'ambar' : b.tono === 'gris' ? 'gris' : 'azul'}`}>{b.accion}</span></td>
                    <td>{b.documento === '—' ? <span className="muted">—</span> : <span className="code">{b.documento}</span>}</td>
                    <td className="muted small">{b.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title="Historial del documento" sub={radicadoDetalle.codigo} icono={<IconReloj size={17} />}>
            <div className="timeline">
              {radicadoDetalle.historial.map((h, i) => (
                <div className={`timeline-item ${h.tono === 'rojo' ? 'rojo' : h.tono === 'verde' ? 'verde' : ''}`} key={i}>
                  <div className="timeline-head">
                    <strong>{h.accion}</strong>
                    <time>{h.fecha}</time>
                  </div>
                  <p>{h.detalle}</p>
                  <span className="muted small">por {h.usuario}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Firmas del documento" sub="Quién firmó y cuándo" icono={<IconFirma size={17} />}>
            <div className="list">
              <div className="list-row">
                <span className="avatar rojo">CV</span>
                <div className="body"><h4>Claudia Vega</h4><p>Firma electrónica · 2026-09-24 16:20</p></div>
                <span className="badge verde"><IconEscudo size={12} /> Válida</span>
              </div>
              <div className="list-row">
                <span className="avatar">AM</span>
                <div className="body"><h4>Andrés Molina</h4><p>Firma electrónica · 2026-09-25 09:35</p></div>
                <span className="badge verde"><IconEscudo size={12} /> Válida</span>
              </div>
            </div>
            <p className="hint mt-16">Hash de verificación: 8f2a4c…c41d</p>
          </Card>

          <Note icono={<IconCandado size={17} />}>
            Los registros de la bitácora son <strong>inmutables</strong>: no se pueden modificar ni eliminar,
            para asegurar su valor probatorio (HU-044).
          </Note>

          <Card title="Sesión auditada" icono={<IconEscudo size={17} />}>
            <Person nombre="Diego Ramírez" detalle="Auditor · consulta de bitácora" tono="rojo" />
          </Card>
        </div>
      </div>

      <Note icono={<IconInfo size={17} />}>
        Filtra por usuario, rango de fechas y tipo de acción para reconstruir el recorrido completo
        de cualquier documento e investigar eventos específicos.
      </Note>
    </>
  )
}

export default Bitacora
