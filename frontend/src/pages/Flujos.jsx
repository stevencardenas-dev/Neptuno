import { useState } from 'react'
import { Card, KV, Note, PageHead } from '../components/ui.jsx'
import { flujos, flujoDetalle } from '../data/mock.js'
import {
  IconAlerta, IconCheck, IconEditar, IconFlujo, IconInfo, IconMas, IconNodo,
  IconPapelera, IconReloj, IconUsuarios, IconVersion, IconFirma, IconOjo,
} from '../components/Icons.jsx'

const W = 178
const H = 110

/* Trazo SVG entre dos nodos: recto si avanzan, en codo si bajan o retroceden */
function trazo(origen, destino) {
  const { x: x1, y: y1 } = origen
  const { x: x2, y: y2 } = destino
  const cx1 = x1 + W / 2
  const cy1 = y1 + H / 2
  const cx2 = x2 + W / 2

  // Vertical: mismo eje X (el flujo baja de fila)
  if (Math.abs(x1 - x2) < 24) return `M ${cx1} ${y1 + H} V ${y2}`
  // Avanza hacia la derecha
  if (x2 > x1) {
    const mid = x1 + W + (x2 - (x1 + W)) / 2
    return `M ${x1 + W} ${cy1} H ${mid} V ${y2 + H / 2} H ${x2}`
  }
  // Retrocede: rodea el nodo por abajo
  const yb = y1 + H + 30
  return `M ${cx1} ${y1 + H} V ${yb} H ${cx2} V ${y2 + H}`
}

/* Posición de la etiqueta según la forma del trazo, para que no se solapen */
function etiqueta(a, b) {
  const cx1 = a.x + W / 2
  const cx2 = b.x + W / 2
  if (Math.abs(a.x - b.x) < 24) return { x: cx1 + 10, y: (a.y + H + b.y) / 2, anchor: 'start' }
  if (b.x > a.x) {
    const mid = a.x + W + (b.x - (a.x + W)) / 2
    return { x: mid, y: a.y + H / 2 - 9, anchor: 'middle' }
  }
  return { x: (cx1 + cx2) / 2, y: a.y + H + 20, anchor: 'middle' }
}

function Flujos() {
  const [selFlujo, setSelFlujo] = useState(flujos[0])
  const [selNodo, setSelNodo] = useState('n3')
  const [selTrans, setSelTrans] = useState('t3')
  const [tab, setTab] = useState('lienzo')

  const d = flujoDetalle
  const nodo = d.nodos.find((n) => n.id === selNodo) ?? d.nodos[0]
  const trans = d.transiciones.find((t) => t.id === selTrans) ?? d.transiciones[0]

  const validaciones = [
    { ok: true, texto: 'Tiene estado inicial (Radicación)' },
    { ok: true, texto: 'Tiene al menos un estado final (Archivado)' },
    { ok: true, texto: 'Sin pasos aislados' },
    { ok: false, texto: 'Falta firma en 1 estado con acción Aprobar' },
  ]

  return (
    <>
      <PageHead
        eyebrow="Diseñador de flujos de trabajo"
        title="Workflow builder"
        sub="Crea circuitos de aprobación con estados, transiciones, responsables y tiempos; publícalos solo cuando estén completos."
        hu={['HU-048', 'HU-049', 'HU-050', 'HU-051', 'HU-052', 'HU-053', 'HU-054', 'HU-055', 'HU-056', 'HU-057', 'HU-058', 'HU-059', 'HU-060', 'HU-061', 'HU-069', 'HU-072', 'HU-073', 'HU-076', 'HU-078', 'HU-079', 'HU-080']}
        actions={[
          <button key="v" className="btn secondary" type="button"><IconVersion size={16} /> Nueva versión</button>,
          <button key="p" className="btn" type="button"><IconCheck size={16} /> Publicar flujo</button>,
        ]}
      />

      <div className="stack">
        <div className="stack">
          <Card tight>
            <div className="row between">
              <div className="row" style={{ gap: 12 }}>
                <span className="stat-icon tono-azul"><IconFlujo size={18} /></span>
                <div>
                  <h3 style={{ fontSize: '1.1rem' }}>{d.nombre}</h3>
                  <span className="muted small">{d.descripcion}</span>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="badge azul">{d.version}</span>
                <span className="badge verde"><span className="dot verde" /> {d.estado}</span>
                <span className="badge gris"><IconReloj size={12} /> {d.duracionMax}</span>
              </div>
            </div>
          </Card>

          <div className="tabs">
            {[
              { id: 'lienzo', label: 'Lienzo' },
              { id: 'flujos', label: 'Listado de flujos' },
              { id: 'versiones', label: 'Versiones' },
            ].map((t) => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} type="button" onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {tab === 'lienzo' ? (
            <div className="flow-canvas">
              <svg className="flow-edges" width="100%" height="100%" aria-hidden="true">
                <defs>
                  <marker id="flecha" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                    <path d="M0 0 L7 3 L0 6" fill="none" stroke="currentColor" style={{ color: 'var(--azul-2)' }} />
                  </marker>
                  <marker id="flechaRoja" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                    <path d="M0 0 L7 3 L0 6" fill="none" stroke="currentColor" style={{ color: 'var(--rojo-suave)' }} />
                  </marker>
                </defs>
                {d.transiciones.map((t) => {
                  const a = d.nodos.find((n) => n.id === t.desde)
                  const b = d.nodos.find((n) => n.id === t.hasta)
                  const roja = t.accion !== 'Aprobar'
                  const hot = t.id === selTrans
                  const pos = etiqueta(a, b)
                  return (
                    <g key={t.id}>
                      <path
                        d={trazo(a, b)}
                        className={`${roja ? 'roja' : ''} ${hot ? 'hot' : ''}`}
                        markerEnd={roja ? 'url(#flechaRoja)' : 'url(#flecha)'}
                        onClick={() => setSelTrans(t.id)}
                        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                      />
                      <text
                        className={`flow-edge-label ${roja ? 'roja' : ''}`}
                        x={pos.x}
                        y={pos.y}
                        textAnchor={pos.anchor}
                      >
                        {t.accion}
                      </text>
                    </g>
                  )
                })}
              </svg>

              {d.nodos.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`flow-node ${n.tipo === 'inicio' ? 'inicio' : ''} ${n.tipo === 'final' ? 'final' : ''} ${selNodo === n.id ? 'selected' : ''}`}
                  style={{ left: n.x, top: n.y, width: W, height: H, textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => setSelNodo(n.id)}
                >
                  <div className="node-top">
                    <strong>{n.nombre}</strong>
                    {n.firma ? <span className="badge rojo" style={{ padding: '2px 7px' }}><IconFirma size={11} /></span> : null}
                  </div>
                  <div className="node-meta">
                    <span>{n.asignacion}</span>
                    <span><IconReloj size={11} /> {n.duracion}{n.tipo === 'inicio' ? ' · inicial' : n.tipo === 'final' ? ' · final' : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {tab === 'flujos' ? (
            <Card tight>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Flujo</th><th>Versión</th><th>Estado</th><th>Nodos</th><th>Docs.</th><th>Modificado</th></tr></thead>
                  <tbody>
                    {flujos.map((f) => (
                      <tr key={f.id} onClick={() => setSelFlujo(f)} style={selFlujo.id === f.id ? { background: 'rgba(47,107,255,0.1)' } : undefined}>
                        <td><strong>{f.nombre}</strong><span className="cell-sub">{f.descripcion}</span></td>
                        <td><span className="badge gris">{f.version}</span></td>
                        <td><span className={`badge ${f.estado === 'Activo' ? 'verde' : f.estado === 'Borrador' ? 'ambar' : 'gris'}`}>{f.estado}</span></td>
                        <td>{f.nodos}</td>
                        <td>{f.documentos}</td>
                        <td className="muted">{f.modificado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {tab === 'versiones' ? (
            <Card title="Versiones del flujo" sub="Los documentos en tránsito conservan la versión con la que iniciaron" icono={<IconVersion size={17} />} tight>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Versión</th><th>Fecha</th><th>Autor</th><th>Estado</th><th>Nota</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                  <tbody>
                    {d.versiones.map((v) => (
                      <tr key={v.version}>
                        <td><span className="code">{v.version}</span></td>
                        <td className="muted">{v.fecha}</td>
                        <td>{v.autor}</td>
                        <td><span className={`badge ${v.estado === 'Vigente' ? 'verde' : 'gris'}`}>{v.estado}</span></td>
                        <td className="muted small">{v.nota}</td>
                        <td><div className="td-actions"><button className="btn ghost sm" type="button" title="Ver"><IconOjo size={15} /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="grid grid-2">
          <Card title="Agregar al lienzo" icono={<IconNodo size={17} />}>
            <div className="flow-palette">
              <button type="button"><IconNodo size={16} /> Agregar estado (nodo)</button>
              <button type="button"><IconFlujo size={16} /> Agregar transición</button>
              <button type="button"><IconCheck size={16} /> Marcar estado inicial / final</button>
              <button type="button"><IconUsuarios size={16} /> Asignar rol o área</button>
            </div>
          </Card>

          <Card
            title={`Estado · ${nodo.nombre}`}
            sub={nodo.tipo === 'inicio' ? 'Estado inicial' : nodo.tipo === 'final' ? 'Estado final' : 'Paso intermedio'}
            icono={<IconEditar size={17} />}
            actions={<button className="btn ghost sm" type="button" title="Eliminar"><IconPapelera size={15} /></button>}
          >
            <div className="field">
              <label>Nombre del estado</label>
              <input type="text" defaultValue={nodo.nombre} />
            </div>
            <div className="field mt-16">
              <label>Descripción</label>
              <textarea defaultValue={`Paso "${nodo.nombre}" del circuito.`} style={{ minHeight: 64 }} />
            </div>
            <div className="field-row mt-16">
              <div className="field">
                <label>Atendido por</label>
                <select defaultValue="Rol">
                  <option>Rol</option><option>Área</option><option>Grupo</option><option>Persona</option>
                </select>
              </div>
              <div className="field">
                <label>Duración máxima del nodo</label>
                <input type="text" defaultValue={nodo.duracion} />
              </div>
            </div>
            <label className="switch mt-16"><input type="checkbox" defaultChecked={nodo.firma} /> Exige firma para aprobar</label>
            <div className="row mt-16" style={{ gap: 6 }}>
              <span className="badge azul">Radicador</span>
              <span className="badge azul">Tesorero</span>
              <button className="badge gris" type="button" style={{ cursor: 'pointer' }}><IconMas size={12} /> rol/área</button>
            </div>
          </Card>

          <Card title={`Transición · ${trans.accion}`} sub={`${d.nodos.find((n) => n.id === trans.desde).nombre} → ${d.nodos.find((n) => n.id === trans.hasta).nombre}`} icono={<IconFlujo size={17} />}>
            <div className="field-row">
              <div className="field">
                <label>Acción permitida</label>
                <select defaultValue={trans.accion}><option>Aprobar</option><option>Rechazar</option><option>Devolver</option></select>
              </div>
              <div className="field">
                <label>Estado destino</label>
                <select defaultValue={d.nodos.find((n) => n.id === trans.hasta).nombre}>
                  {d.nodos.map((n) => <option key={n.id}>{n.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="row mt-16">
              <button className="btn sm" type="button"><IconCheck size={15} /> Guardar</button>
              <button className="btn ghost sm" type="button"><IconPapelera size={15} /> Eliminar transición</button>
            </div>
          </Card>

          <Card title="Validación para publicar" icono={<IconAlerta size={17} />}>
            <div className="stack" style={{ gap: 10 }}>
              {validaciones.map((v) => (
                <div className="row" key={v.texto} style={{ gap: 10 }}>
                  <span className={`dot ${v.ok ? 'verde' : 'rojo'}`} />
                  <span className={v.ok ? 'muted' : 'strong'}>{v.texto}</span>
                </div>
              ))}
            </div>
            <button className="btn mt-16 block" type="button" disabled={validaciones.some((v) => !v.ok)}>
              <IconCheck size={16} /> Publicar flujo
            </button>
            <p className="hint mt-8">Un flujo solo se publica si está completo y sin pasos aislados.</p>
          </Card>

          <Card title="Datos generales" icono={<IconFlujo size={17} />}>
            <KV items={[
              { k: 'Duración máxima global', v: d.duracionMax },
              { k: 'Responsables', v: 'Radicador, Tesorero, Gerencia' },
              { k: 'Estados', v: `${d.nodos.length}` },
              { k: 'Transiciones', v: `${d.transiciones.length}` },
            ]} />
          </Card>

          <Note icono={<IconInfo size={17} />}>
            Al crear una <strong>nueva versión</strong> de un flujo activo, los documentos en tránsito
            continúan con la versión con la que iniciaron para mantener la retrocompatibilidad.
          </Note>
        </div>
      </div>
    </>
  )
}

export default Flujos
