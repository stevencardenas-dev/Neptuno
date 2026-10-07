/**
 * Iconos SVG en línea. Se dibujan con currentColor para heredar el color del
 * contexto y evitar añadir una librería de iconos al proyecto.
 */
function Svg({ size = 18, children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconResumen = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="2.2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2.2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2.2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.2" /></Svg>
)
export const IconDocumentos = (p) => (
  <Svg {...p}><path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></Svg>
)
export const IconUsuarios = (p) => (
  <Svg {...p}><circle cx="9" cy="8.5" r="3.3" /><path d="M3.2 20a5.9 5.9 0 0 1 11.6 0" /><path d="M16.4 5.6a3 3 0 0 1 0 5.8M17.6 20a5.6 5.6 0 0 0-2-4.2" /></Svg>
)
export const IconRoles = (p) => (
  <Svg {...p}><path d="M12 3l7 2.8v5.4c0 4.3-2.9 8.1-7 9.6-4.1-1.5-7-5.3-7-9.6V5.8z" /><path d="M9.1 12.2l2 2.1 3.9-4" /></Svg>
)
export const IconConfig = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3.1" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1.7a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 3.3 7.5a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1A1.6 1.6 0 0 0 9.3 1.7V1.7a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></Svg>
)
export const IconMas = (p) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>)
export const IconSalir = (p) => (
  <Svg {...p}><path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20H15" /><path d="M10 8l-4 4 4 4M6 12h9" /></Svg>
)
export const IconCandado = (p) => (
  <Svg {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2.6" /><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" /><path d="M12 14.6v2.2" /></Svg>
)
export const IconArchivo = (p) => (
  <Svg {...p}><path d="M13.5 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8.5z" /><path d="M13.5 3v5.5H19" /></Svg>
)
export const IconPapelera = (p) => (
  <Svg {...p}><path d="M4 7h16" /><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" /><path d="M6 7l1 12.5A2 2 0 0 0 9 21.5h6a2 2 0 0 0 2-2L18 7" /><path d="M10 11v6M14 11v6" /></Svg>
)
export const IconEditar = (p) => (
  <Svg {...p}><path d="M4 20h4l10-10a2.4 2.4 0 0 0-3.4-3.4L4 16.5z" /><path d="M13.5 7.5l3 3" /></Svg>
)
export const IconCheck = (p) => (<Svg {...p}><path d="M5 12.5l4.5 4.5L19 6.5" /></Svg>)
export const IconCerrar = (p) => (<Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>)
export const IconFiltro = (p) => (<Svg {...p}><path d="M3 5h18l-7 8v5l-4 2v-7z" /></Svg>)
export const IconEscudo = (p) => (
  <Svg {...p}><path d="M12 3l7 2.8v5.4c0 4.3-2.9 8.1-7 9.6-4.1-1.5-7-5.3-7-9.6V5.8z" /></Svg>
)
export const IconGlobo = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.6" /><path d="M3.4 12h17.2" /><path d="M12 3.4c2.3 2.4 3.5 5.4 3.5 8.6S14.3 18.2 12 20.6c-2.3-2.4-3.5-5.4-3.5-8.6S9.7 5.8 12 3.4z" /></Svg>
)
export const IconInfo = (p) => (<Svg {...p}><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.5" /><path d="M12 8h.01" /></Svg>)
export const IconTridente = (p) => (
  <Svg {...p}>
    <path d="M7 3v6.5" />
    <path d="M17 3v6.5" />
    <path d="M12 2v7.5" />
    <path d="M7 9.5h10" />
    <path d="M12 9.5V18" />
    <path d="M9.6 18l2.4 3 2.4-3" />
  </Svg>
)
