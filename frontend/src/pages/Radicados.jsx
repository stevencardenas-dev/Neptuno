import { useMemo, useState } from 'react'
import { Card, KV, Note, PageHead } from '../components/ui.jsx'
import { radicadoDetalle, radicados, tiposDocumentales, areas } from '../data/mock.js'
import {
  IconDescargar, IconEditar, IconFiltro, IconInfo, IconOjo,
  IconArchivo, IconFlujo, IconReloj,
} from '../components/Icons.jsx'

const origenBadge = { Interno: 'azul', Externo: 'violeta', Recibido: 'ambar', 'No radicable': 'gris' }
const estadoBadge = { Aprobado: 'verde', 'En revisión': 'ambar', Radicado: 'azul', Rechazado: 'rojo', Devuelto: 'rojo', 'En firma': 'violeta', Archivado: 'gris' }

function Radicados() {
  const [fCodigo, setFCodigo] = useState('')
  const [fOrigen, setFOrigen] = useState('Todos')
  const [fTipo, setFTipo] = useState('Todos')
  const [fArea, setFArea] = useState('Todos')
  const [sel, setSel] = useState(radicados[0])

  const filtrados = useMemo(() => radicados.filter((r) => {
    const okCodigo = r.codigo.includes(fCodigo) || r.titulo.toLowerCase().includes(fCodigo.toLowerCase())
    const okOrigen = fOrigen === 'Todos' || r.origen === fOrigen
    const okTipo = fTipo === 'Todos' || r.tipo === fTipo
    const okArea = fArea === 'Todos' || r.area === fArea
    return okCodigo && okOrigen && okTipo && okArea
  }), [fCodigo, fOrigen, fTipo, fArea])

  const detalle = sel.codigo === radicadoDetalle.codigo ? radicadoDetalle : null

  return (
    <>
      <PageHead
        eyebrow="Consulta y buscador de radicados"
        title="Consultar radicados"
        sub="Lista, filtra y abre el detalle de cualquier documento: metadatos, anexos y estado actual."
        hu={['HU-020', 'HU-023', 'HU-028']}
      />

      <div className="toolbar">
        <label className="field grow" style={{ maxWidth: 260 }}>
          <input type="search" placeholder="Código o título…" value={fCodigo} onChange={(e) => setFCodigo(e.target.value)} />
        </label>
        <label className="field"><input type="date" defaultValue="2026-09-01" aria-label="Desde" /></label>
        <label className="field"><input type="date" defaultValue="2026-09-25" aria-label="Hasta" /></label>
        <label className="field" style={{ minWidth: 150 }}>
          <select value={fOrigen} onChange={(e) => setFOrigen(e.target.value)}>
            <option>Todos</option><option>Interno</option><option>Externo</option><option>Recibido</option><option>No radicable</option>
          </select>
        </label>
        <label className="field" style={{ minWidth: 160 }}>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option>Todos</option>{tiposDocumentales.map((t) => <option key={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 180 }}>
          <select value={fArea} onChange={(e) => setFArea(e.target.value)}>
            <option>Todos</option>{areas.map((a) => <option key={a.id}>{a.nombre}</option>)}
          </select>
        </label>
        <span className="badge azul" style={{ marginLeft: 'auto' }}><IconFiltro size={13} /> {filtrados.length} resultados</span>
      </div>

      <div className="grid grid-side mt-16">
        <Card tight>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Código</th><th>Título</th><th>Origen</th><th>Tipo</th><th>Área</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.codigo} onClick={() => setSel(r)} style={sel.codigo === r.codigo ? { background: 'rgba(47,107,255,0.1)' } : undefined}>
                    <td><span className="code">{r.codigo}</span></td>
                    <td><strong>{r.titulo}</strong><span className="cell-sub">{r.fecha} · {r.clase} · {r.anexos} anexos</span></td>
                    <td><span className={`badge ${origenBadge[r.origen]}`}>{r.origen}</span></td>
                    <td className="muted">{r.tipo}</td>
                    <td className="muted">{r.area}</td>
                    <td><span className={`badge ${estadoBadge[r.estado]}`}><span className={`dot ${estadoBadge[r.estado] === 'gris' ? 'gris' : estadoBadge[r.estado]}`} /> {r.estado}</span></td>
                  </tr>
                ))}
                {!filtrados.length ? <tr><td colSpan={6}><div className="empty">No hay radicados que coincidan con los filtros.</div></td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title="Detalle del radicado" sub={sel.codigo} icono={<IconOjo size={17} />}>
            <div className="row between">
              <span className="code" style={{ fontSize: '1rem' }}>{sel.codigo}</span>
              <span className={`badge ${estadoBadge[sel.estado]}`}>{sel.estado}</span>
            </div>
            <h3 className="mt-16" style={{ fontSize: '1.05rem' }}>{sel.titulo}</h3>
            <KV items={[
              { k: 'Origen', v: sel.origen },
              { k: 'Tipo documental', v: sel.tipo },
              { k: 'Área encargada', v: sel.area },
              { k: 'Clase', v: sel.clase },
              { k: 'Fecha', v: sel.fecha },
            ]} />
            {detalle ? (
              <>
                <div className="divider mt-16" />
                <p className="muted small mt-16">{detalle.resumen}</p>
                <div className="row mt-16">
                  <span className="badge gris">NIT {detalle.nit}</span>
                  <span className="badge gris">{detalle.entidad}</span>
                </div>
                <div className="row mt-16">
                  <button className="btn secondary sm" type="button"><IconEditar size={15} /> Editar metadatos</button>
                  <button className="btn sm" type="button"><IconFlujo size={15} /> Enviar a flujo</button>
                </div>
              </>
            ) : (
              <Note icono={<IconInfo size={17} />}>
                Abre el radicado <strong>20260925300012</strong> para ver su ficha completa con anexos e historial.
              </Note>
            )}
          </Card>

          {detalle ? (
            <>
              <Card title="Anexos" sub={`${detalle.anexos.length} archivos`} icono={<IconArchivo size={17} />}>
                <div className="stack" style={{ gap: 10 }}>
                  {detalle.anexos.map((a) => (
                    <div className="chip-file" key={a.nombre}>
                      <span className={`ext ${a.ext}`}>{a.ext.toUpperCase()}</span>
                      <div className="meta"><strong>{a.nombre}</strong><small>{a.peso} · {a.subidoPor}</small></div>
                      <button className="btn ghost sm" type="button" title="Descargar"><IconDescargar size={15} /></button>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Estado actual" icono={<IconFlujo size={17} />}>
                <KV items={[
                  { k: 'Flujo', v: detalle.flujo },
                  { k: 'Paso actual', v: detalle.pasoActual },
                  { k: 'Radicado por', v: detalle.creadoPor },
                  { k: 'Creado el', v: detalle.creadoEl },
                ]} />
              </Card>

              <Card title="Historial" icono={<IconReloj size={17} />}>
                <div className="timeline">
                  {detalle.historial.map((h, i) => (
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
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}

export default Radicados
