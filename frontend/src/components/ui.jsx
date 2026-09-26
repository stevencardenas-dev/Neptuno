import { IconCerrar } from './Icons.jsx'

/* Encabezado de vista, con la sección y las HU cubiertas */
export function PageHead({ eyebrow, title, sub, hu = [], actions }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
        {hu.length ? (
          <div className="hu" title="Historias de usuario cubiertas por esta vista">
            {hu.map((h) => <span key={h}>{h}</span>)}
          </div>
        ) : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  )
}

/* Tarjeta de métrica */
export function Stat({ tono = 'azul', icono, label, valor, nota, bar = true }) {
  return (
    <div className={`stat tono-${tono}`}>
      <div className="stat-top">
        <span className="stat-icon">{icono}</span>
      </div>
      <div>
        <div className="stat-value">{valor}</div>
        <div className="stat-label">{label}</div>
      </div>
      {bar ? <div className="stat-bar" /> : null}
      {nota ? <div className="stat-note">{nota}</div> : null}
    </div>
  )
}

/* Tarjeta con cabecera y cuerpo */
export function Card({ title, sub, icono, actions, children, className = '', tight = false }) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <header className="card-head">
          <div>
            <h3>{icono}{title}</h3>
            {sub ? <p>{sub}</p> : null}
          </div>
          {actions ? <div className="row">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`card-body${tight ? ' tight' : ''}`}>{children}</div>
    </section>
  )
}

/* Nota informativa */
export function Note({ children, tono = 'azul', icono }) {
  return (
    <div className={`note ${tono === 'rojo' ? 'rojo' : ''}`}>
      {icono}
      <p>{children}</p>
    </div>
  )
}

/* Modal genérico */
export function Modal({ open, title, sub, onClose, children, footer, ancho }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal" style={ancho ? { width: ancho } : undefined} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h3>{title}</h3>
            {sub ? <p>{sub}</p> : null}
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar">
            <IconCerrar size={17} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  )
}

/* Fila del tipo clave / valor */
export function KV({ items }) {
  return (
    <dl className="kv">
      {items.map(({ k, v }) => (
        <div key={k}>
          <dt className="k">{k}</dt>
          <dd className="v">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* Persona: avatar + nombre + detalle */
export function Person({ nombre, detalle, tono = '' }) {
  const iniciales = nombre.split(' ').slice(0, 2).map((p) => p[0]).join('')
  return (
    <div className="person">
      <span className={`avatar ${tono}`}>{iniciales}</span>
      <div>
        <strong>{nombre}</strong>
        {detalle ? <small>{detalle}</small> : null}
      </div>
    </div>
  )
}
