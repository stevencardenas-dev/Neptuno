import { useState } from 'react'
import { Card, Note, PageHead } from '../components/ui.jsx'
import { carpetaDetalle, expediente } from '../data/mock.js'
import {
  IconArchivo, IconCarpeta, IconChevron, IconDescargar, IconEscudo,
  IconExpediente, IconInfo, IconMas, IconOjo,
} from '../components/Icons.jsx'

function Nodo({ nodo, abiertos, toggle, sel, setSel, nivel = 0 }) {
  const tieneHijos = nodo.children?.length
  const abierto = abiertos.includes(nodo.id)
  return (
    <>
      <div
        className={`tree-node ${sel === nodo.id ? 'selected' : ''}`}
        onClick={() => { setSel(nodo.id); if (tieneHijos) toggle(nodo.id) }}
        style={{ paddingLeft: 12 + nivel * 4 }}
      >
        {tieneHijos ? (
          <span style={{ transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 160ms', color: 'var(--texto-tenue)' }}>
            <IconChevron size={14} />
          </span>
        ) : <span style={{ width: 14 }} />}
        {nodo.tipo === 'area' ? <IconArchivo size={16} /> : <IconCarpeta size={16} />}
        <span className="tree-label">{nodo.nombre}</span>
        <span className="tree-count">{nodo.count}</span>
      </div>
      {tieneHijos && abierto ? (
        <div className="tree-children">
          {nodo.children.map((h) => (
            <Nodo key={h.id} nodo={h} abiertos={abiertos} toggle={toggle} sel={sel} setSel={setSel} nivel={nivel + 1} />
          ))}
        </div>
      ) : null}
    </>
  )
}

function Expediente() {
  const [abiertos, setAbiertos] = useState(['e2', 'e2-1'])
  const [sel, setSel] = useState('e2-1-1')

  const toggle = (id) => setAbiertos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  return (
    <>
      <PageHead
        eyebrow="Expediente central (archivo)"
        title="Expediente central"
        sub="Estructura el archivo institucional por área y subcarpetas, y consulta los documentos originales almacenados."
        hu={['HU-030', 'HU-031', 'HU-032', 'HU-033']}
        actions={[
          <button key="s" className="btn secondary" type="button"><IconCarpeta size={16} /> Nueva subcarpeta</button>,
          <button key="a" className="btn" type="button"><IconMas size={16} /> Nueva carpeta de área</button>,
        ]}
      />

      <div className="grid grid-archivo">
        <Card title="Árbol del expediente" sub="Carpetas por área y subcarpetas temáticas" icono={<IconExpediente size={17} />} tight>
          <div className="tree">
            {expediente.map((n) => (
              <Nodo key={n.id} nodo={n} abiertos={abiertos} toggle={toggle} sel={sel} setSel={setSel} />
            ))}
          </div>
        </Card>

        <div className="stack">
          <Card
            title={carpetaDetalle.nombre}
            sub={`${carpetaDetalle.documentos.length} documentos originales`}
            icono={<IconCarpeta size={17} />}
            actions={<button className="btn secondary sm" type="button"><IconDescargar size={15} /> Exportar</button>}
          >
            <div className="list">
              {carpetaDetalle.documentos.map((d) => (
                <div className="list-row" key={d.codigo}>
                  <span className="stat-icon tono-azul" style={{ width: 36, height: 36 }}><IconArchivo size={17} /></span>
                  <div className="body">
                    <h4>{d.titulo}</h4>
                    <p><span className="code">{d.codigo}</span> · {d.fecha} · {d.anexos} anexos</p>
                  </div>
                  <div className="side">
                    <span className={`badge ${d.clase === 'Original' ? 'verde' : 'ambar'}`}>{d.clase}</span>
                    <button className="btn ghost sm" type="button" title="Ver documento"><IconOjo size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Visibilidad por rol y área" icono={<IconEscudo size={17} />}>
            <Note icono={<IconInfo size={17} />}>
              El sistema <strong>filtra la visibilidad</strong> de carpetas y subcarpetas según los
              permisos del rol y el área del usuario.
            </Note>
            <div className="stack mt-16" style={{ gap: 10 }}>
              <div className="row between"><span className="muted">Contabilidad y Tesorería</span><span className="badge verde">Visible para tu rol</span></div>
              <div className="row between"><span className="muted">Gerencia General</span><span className="badge verde">Visible para tu rol</span></div>
              <div className="row between"><span className="muted">Jurídica</span><span className="badge ambar">Solo lectura</span></div>
              <div className="row between"><span className="muted">Gestión Humana</span><span className="badge gris">Restringida</span></div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

export default Expediente
