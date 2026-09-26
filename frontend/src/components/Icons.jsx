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
export const IconRadicar = (p) => (
  <Svg {...p}><path d="M12 4v10" /><path d="M8 8l4-4 4 4" /><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" /></Svg>
)
export const IconBuscar = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>
)
export const IconExpediente = (p) => (
  <Svg {...p}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17z" /></Svg>
)
export const IconPlantillas = (p) => (
  <Svg {...p}><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h4" /></Svg>
)
export const IconFlujo = (p) => (
  <Svg {...p}><circle cx="6" cy="6" r="2.6" /><circle cx="18" cy="18" r="2.6" /><rect x="15.4" y="3.4" width="5.2" height="5.2" rx="1.6" /><path d="M6 8.6V12a3 3 0 0 0 3 3h6" /><path d="M15.6 6.5A6 6 0 0 1 18 12v3.4" /></Svg>
)
export const IconBandeja = (p) => (
  <Svg {...p}><path d="M3 13l2.4-7.2A2 2 0 0 1 7.3 4.4h9.4a2 2 0 0 1 1.9 1.4L21 13v4.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 13h5l1.2 2.4h5.6L16 13h5" /></Svg>
)
export const IconBitacora = (p) => (
  <Svg {...p}><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22z" /><path d="M5 4.5A2.5 2.5 0 0 0 2.5 7v13H5" /><path d="M9 8h6M9 12h4" /></Svg>
)
export const IconRendimiento = (p) => (
  <Svg {...p}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5M12 16V8M16 16v-3" /></Svg>
)
export const IconMas = (p) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>)
export const IconSalir = (p) => (
  <Svg {...p}><path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20H15" /><path d="M10 8l-4 4 4 4M6 12h9" /></Svg>
)
export const IconCandado = (p) => (
  <Svg {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2.6" /><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" /><path d="M12 14.6v2.2" /></Svg>
)
export const IconCampana = (p) => (
  <Svg {...p}><path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></Svg>
)
export const IconCarpeta = (p) => (
  <Svg {...p}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5V17a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17z" /></Svg>
)
export const IconArchivo = (p) => (
  <Svg {...p}><path d="M13.5 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8.5z" /><path d="M13.5 3v5.5H19" /></Svg>
)
export const IconSubir = (p) => (
  <Svg {...p}><path d="M12 15V4" /><path d="M8 8l4-4 4 4" /><path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16" /></Svg>
)
export const IconDescargar = (p) => (
  <Svg {...p}><path d="M12 4v11" /><path d="M8 11l4 4 4-4" /><path d="M4 18.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.5" /></Svg>
)
export const IconPapelera = (p) => (
  <Svg {...p}><path d="M4 7h16" /><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" /><path d="M6 7l1 12.5A2 2 0 0 0 9 21.5h6a2 2 0 0 0 2-2L18 7" /><path d="M10 11v6M14 11v6" /></Svg>
)
export const IconEditar = (p) => (
  <Svg {...p}><path d="M4 20h4l10-10a2.4 2.4 0 0 0-3.4-3.4L4 16.5z" /><path d="M13.5 7.5l3 3" /></Svg>
)
export const IconCheck = (p) => (<Svg {...p}><path d="M5 12.5l4.5 4.5L19 6.5" /></Svg>)
export const IconCerrar = (p) => (<Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>)
export const IconDevolver = (p) => (
  <Svg {...p}><path d="M9 14l-4-4 4-4" /><path d="M5 10h9a5 5 0 0 1 5 5v1a3 3 0 0 1-3 3" /></Svg>
)
export const IconFiltro = (p) => (<Svg {...p}><path d="M3 5h18l-7 8v5l-4 2v-7z" /></Svg>)
export const IconFlecha = (p) => (<Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>)
export const IconChevron = (p) => (<Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>)
export const IconFirma = (p) => (
  <Svg {...p}><path d="M4 17c3-1 4-9 7-9s2 7 4 7 2-3 5-3" /><path d="M3 20.5h18" /></Svg>
)
export const IconMovil = (p) => (
  <Svg {...p}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></Svg>
)
export const IconReloj = (p) => (<Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>)
export const IconEscudo = (p) => (
  <Svg {...p}><path d="M12 3l7 2.8v5.4c0 4.3-2.9 8.1-7 9.6-4.1-1.5-7-5.3-7-9.6V5.8z" /></Svg>
)
export const IconGlobo = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.6" /><path d="M3.4 12h17.2" /><path d="M12 3.4c2.3 2.4 3.5 5.4 3.5 8.6S14.3 18.2 12 20.6c-2.3-2.4-3.5-5.4-3.5-8.6S9.7 5.8 12 3.4z" /></Svg>
)
export const IconDestello = (p) => (
  <Svg {...p}><path d="M12 3.2l1.9 4.9 4.9 1.9-4.9 1.9L12 16.8l-1.9-4.9L5.2 10l4.9-1.9z" /><path d="M18.4 16.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></Svg>
)
export const IconInfo = (p) => (<Svg {...p}><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.5" /><path d="M12 8h.01" /></Svg>)
export const IconAlerta = (p) => (
  <Svg {...p}><path d="M12 4l8.5 15H3.5z" /><path d="M12 10v4" /><path d="M12 17h.01" /></Svg>
)
export const IconGuardar = (p) => (
  <Svg {...p}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H16l4 4v12.5A1.5 1.5 0 0 1 18.5 21h-12A1.5 1.5 0 0 1 5 19.5z" /><path d="M8 3v5h7V3" /><path d="M8 21v-6h8v6" /></Svg>
)
export const IconVersion = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.5 2" /><path d="M12 3.5V6" /></Svg>
)
export const IconOjo = (p) => (
  <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></Svg>
)
/* Tridente de Neptuno: icono de marca del sistema */
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
export const IconNodo = (p) => (
  <Svg {...p}><rect x="3.5" y="8.5" width="7" height="7" rx="2" /><rect x="13.5" y="8.5" width="7" height="7" rx="2" /><path d="M10.5 12h3" /></Svg>
)
export const IconLupaDoc = (p) => (
  <Svg {...p}><path d="M13 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21H12" /><path d="M13 3v5h5V3" /><circle cx="16.5" cy="16.5" r="3.2" /><path d="M19 19l2 2" /></Svg>
)
export const IconCalendario = (p) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M8 3.5V6M16 3.5V6" /></Svg>
)
