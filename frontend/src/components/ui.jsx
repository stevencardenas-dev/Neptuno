import { useEffect } from 'react'
import { iniciales } from '../util/formato.js'
import { IconCerrar } from './Icons.jsx'

/* Encabezado de vista */
export function PageHead({ eyebrow, title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
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
  // Escape cierra el modal, como se espera de cualquier diálogo.
  useEffect(() => {
    if (!open) return undefined
    const alPresionar = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [open, onClose])

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
  return (
    <div className="person">
      <span className={`avatar ${tono}`}>{iniciales(nombre)}</span>
      <div>
        <strong>{nombre}</strong>
        {detalle ? <small>{detalle}</small> : null}
      </div>
    </div>
  )
}
