/* ============================================================
   Neptuno · Datos mock para las vistas / mockups.
   Todo es estático: sirve para navegar y tomar capturas sin backend.
   ============================================================ */

export const sesion = {
  nombre: 'Laura Restrepo',
  correo: 'laura.restrepo@neptuno.gov.co',
  area: 'Subdirección Administrativa',
  rolPrincipal: 'Administrador',
  roles: ['Administrador', 'Radicador', 'Auditor'],
  iniciales: 'LR',
}

/* ---------------- Configuración ---------------- */

export const areas = [
  { id: 'ARE-01', nombre: 'Subdirección Administrativa', responsable: 'Laura Restrepo', documentos: 184, estado: 'Activa' },
  { id: 'ARE-02', nombre: 'Contabilidad y Tesorería', responsable: 'Andrés Molina', documentos: 327, estado: 'Activa' },
  { id: 'ARE-03', nombre: 'Gerencia General', responsable: 'Claudia Vega', documentos: 92, estado: 'Activa' },
  { id: 'ARE-04', nombre: 'Gestión Humana', responsable: 'Paola Suárez', documentos: 141, estado: 'Activa' },
  { id: 'ARE-05', nombre: 'Jurídica', responsable: 'Diego Ramírez', documentos: 76, estado: 'Activa' },
  { id: 'ARE-06', nombre: 'Compras y Proveedores', responsable: 'Mateo Arias', documentos: 210, estado: 'Inactiva' },
]

export const tiposDocumentales = [
  { id: 'TD-01', nombre: 'Factura', prefijo: 'FAC', origenes: ['Recibido'], estado: 'Activo' },
  { id: 'TD-02', nombre: 'Orden de compra', prefijo: 'OC', origenes: ['Interno'], estado: 'Activo' },
  { id: 'TD-03', nombre: 'Contrato', prefijo: 'CON', origenes: ['Interno', 'Externo'], estado: 'Activo' },
  { id: 'TD-04', nombre: 'Resolución', prefijo: 'RES', origenes: ['Interno'], estado: 'Activo' },
  { id: 'TD-05', nombre: 'Cuenta de cobro', prefijo: 'CC', origenes: ['Recibido'], estado: 'Activo' },
  { id: 'TD-06', nombre: 'Memorando', prefijo: 'MEM', origenes: ['Interno'], estado: 'Activo' },
  { id: 'TD-07', nombre: 'Acta', prefijo: 'ACT', origenes: ['Interno'], estado: 'Inactivo' },
]

export const entidades = [
  { nit: '900.123.456-1', razonSocial: 'Suministros del Norte S.A.S.', ciudad: 'Bogotá', tipo: 'Proveedor', estado: 'Activa' },
  { nit: '830.998.221-7', razonSocial: 'CloudTech Ingeniería Ltda.', ciudad: 'Medellín', tipo: 'Proveedor', estado: 'Activa' },
  { nit: '800.445.102-3', razonSocial: 'Alcaldía Municipal de Soacha', ciudad: 'Soacha', tipo: 'Entidad pública', estado: 'Activa' },
  { nit: '901.220.778-5', razonSocial: 'Papelería Central S.A.', ciudad: 'Cali', tipo: 'Proveedor', estado: 'Activa' },
  { nit: '860.011.909-2', razonSocial: 'Transportes Andinos', ciudad: 'Bucaramanga', tipo: 'Proveedor', estado: 'Inactiva' },
]

export const respaldos = [
  { id: 'BK-2026-09-25', fecha: '2026-09-25 02:00', tipo: 'Automático', tamano: '4.8 GB', documentos: 1240, bitacora: '184.320 registros', estado: 'Completado' },
  { id: 'BK-2026-09-24', fecha: '2026-09-24 02:00', tipo: 'Automático', tamano: '4.7 GB', documentos: 1232, bitacora: '183.870 registros', estado: 'Completado' },
  { id: 'BK-2026-09-23', fecha: '2026-09-23 02:00', tipo: 'Automático', tamano: '4.7 GB', documentos: 1228, bitacora: '183.402 registros', estado: 'Completado' },
  { id: 'BK-2026-09-20', fecha: '2026-09-20 11:35', tipo: 'Manual', tamano: '4.6 GB', documentos: 1210, bitacora: '182.110 registros', estado: 'Completado' },
  { id: 'BK-2026-09-19', fecha: '2026-09-19 02:00', tipo: 'Automático', tamano: '4.6 GB', documentos: 1198, bitacora: '181.665 registros', estado: 'Con advertencias' },
]

/* ---------------- Usuarios y roles ---------------- */

export const usuarios = [
  { id: 'US-001', nombre: 'Laura Restrepo', correo: 'laura.restrepo@neptuno.gov.co', area: 'Subdirección Administrativa', roles: ['Administrador'], estado: 'Activo', ultimoAcceso: 'Hoy 08:41' },
  { id: 'US-002', nombre: 'Andrés Molina', correo: 'andres.molina@neptuno.gov.co', area: 'Contabilidad y Tesorería', roles: ['Tesorero'], estado: 'Activo', ultimoAcceso: 'Hoy 07:55' },
  { id: 'US-003', nombre: 'Claudia Vega', correo: 'claudia.vega@neptuno.gov.co', area: 'Gerencia General', roles: ['Gerente', 'Aprobador'], estado: 'Activo', ultimoAcceso: 'Ayer 18:20' },
  { id: 'US-004', nombre: 'Paola Suárez', correo: 'paola.suarez@neptuno.gov.co', area: 'Gestión Humana', roles: ['Radicador'], estado: 'Activo', ultimoAcceso: 'Hoy 09:02' },
  { id: 'US-005', nombre: 'Diego Ramírez', correo: 'diego.ramirez@neptuno.gov.co', area: 'Jurídica', roles: ['Auditor'], estado: 'Activo', ultimoAcceso: '23 sep 16:10' },
  { id: 'US-006', nombre: 'Mateo Arias', correo: 'mateo.arias@neptuno.gov.co', area: 'Compras y Proveedores', roles: ['Radicador', 'Tesorero'], estado: 'Activo', ultimoAcceso: '22 sep 11:48' },
  { id: 'US-007', nombre: 'Sofía Cárdenas', correo: 'sofia.cardenas@neptuno.gov.co', area: 'Contabilidad y Tesorería', roles: ['Tesorero'], estado: 'Inactivo', ultimoAcceso: '05 sep 09:31' },
  { id: 'US-008', nombre: 'Julián Ospina', correo: 'julian.ospina@neptuno.gov.co', area: 'Subdirección Administrativa', roles: ['Radicador'], estado: 'Inactivo', ultimoAcceso: '18 ago 15:22' },
]

export const roles = [
  { id: 'ROL-01', nombre: 'Administrador', descripcion: 'Acceso total a configuración, usuarios, roles y parámetros del sistema.', permisos: 24, usuarios: 1, tipo: 'Sistema' },
  { id: 'ROL-02', nombre: 'Radicador', descripcion: 'Registra y clasifica documentos, gestiona anexos y radica correspondencia.', permisos: 12, usuarios: 3, tipo: 'Operativo' },
  { id: 'ROL-03', nombre: 'Tesorero', descripcion: 'Gestiona pagos, valida cuentas de cobro y aprueba documentos financieros.', permisos: 9, usuarios: 3, tipo: 'Operativo' },
  { id: 'ROL-04', nombre: 'Gerente', descripcion: 'Aprueba documentos estratégicos y aplica firma electrónica.', permisos: 11, usuarios: 1, tipo: 'Aprobador' },
  { id: 'ROL-05', nombre: 'Auditor', descripcion: 'Consulta la bitácora y el historial documental sin poder modificarlo.', permisos: 6, usuarios: 1, tipo: 'Control' },
  { id: 'ROL-06', nombre: 'Aprobador', descripcion: 'Atiende tareas de flujo y aprueba, rechaza o devuelve documentos.', permisos: 8, usuarios: 1, tipo: 'Aprobador' },
]

export const permisosCatalogo = [
  { modulo: 'Usuarios y roles', items: [
    { nombre: 'Crear usuarios', activo: true },
    { nombre: 'Editar usuarios', activo: true },
    { nombre: 'Eliminar usuarios (baja lógica)', activo: true },
    { nombre: 'Asignar roles', activo: true },
    { nombre: 'Administrar permisos de rol', activo: true },
  ]},
  { modulo: 'Radicación', items: [
    { nombre: 'Registrar radicados', activo: true },
    { nombre: 'Editar metadatos de radicado', activo: true },
    { nombre: 'Cargar anexos', activo: true },
    { nombre: 'Eliminar anexos', activo: true },
    { nombre: 'Radicar origen Recibido', activo: true },
    { nombre: 'Marcar clase Original / Copia', activo: true },
  ]},
  { modulo: 'Flujo de trabajo', items: [
    { nombre: 'Iniciar flujo', activo: false },
    { nombre: 'Aprobar documento', activo: false },
    { nombre: 'Rechazar documento', activo: false },
    { nombre: 'Aplicar firma electrónica', activo: false },
  ]},
  { modulo: 'Expediente y auditoría', items: [
    { nombre: 'Ver expediente central', activo: true },
    { nombre: 'Crear carpetas del expediente', activo: true },
    { nombre: 'Consultar bitácora', activo: true },
    { nombre: 'Filtrar bitácora', activo: true },
  ]},
]

/* ---------------- Radicados ---------------- */

export const radicados = [
  { codigo: '20260925300012', titulo: 'Solicitud de compra de equipos de cómputo', origen: 'Recibido', tipo: 'Factura', area: 'Compras y Proveedores', estado: 'En revisión', fecha: '2026-09-25', clase: 'Original', anexos: 3 },
  { codigo: '20260925100008', titulo: 'Memorando de asignación de viáticos', origen: 'Interno', tipo: 'Memorando', area: 'Gestión Humana', estado: 'Aprobado', fecha: '2026-09-25', clase: 'Original', anexos: 1 },
  { codigo: '20260924200021', titulo: 'Contrato de prestación de servicios TI', origen: 'Externo', tipo: 'Contrato', area: 'Jurídica', estado: 'En firma', fecha: '2026-09-24', clase: 'Original', anexos: 5 },
  { codigo: '20260924300034', titulo: 'Factura de servicios públicos agosto', origen: 'Recibido', tipo: 'Factura', area: 'Contabilidad y Tesorería', estado: 'Radicado', fecha: '2026-09-24', clase: 'Original', anexos: 2 },
  { codigo: '20260923100015', titulo: 'Resolución de reconocimiento de gastos', origen: 'Interno', tipo: 'Resolución', area: 'Gerencia General', estado: 'Rechazado', fecha: '2026-09-23', clase: 'Original', anexos: 1 },
  { codigo: '20260923300009', titulo: 'Cuenta de cobro honorarios septiembre', origen: 'Recibido', tipo: 'Cuenta de cobro', area: 'Contabilidad y Tesorería', estado: 'Devuelto', fecha: '2026-09-23', clase: 'Copia', anexos: 4 },
  { codigo: '20260922400041', titulo: 'Certificado bancario de soporte', origen: 'No radicable', tipo: 'Anexo', area: 'Compras y Proveedores', estado: 'Archivado', fecha: '2026-09-22', clase: 'Original', anexos: 1 },
  { codigo: '20260922100007', titulo: 'Acta de comité de compras', origen: 'Interno', tipo: 'Acta', area: 'Compras y Proveedores', estado: 'Aprobado', fecha: '2026-09-22', clase: 'Original', anexos: 2 },
]

export const radicadoDetalle = {
  codigo: '20260925300012',
  titulo: 'Solicitud de compra de equipos de cómputo',
  origen: 'Recibido',
  tipo: 'Factura',
  area: 'Compras y Proveedores',
  estado: 'En revisión',
  fecha: '2026-09-25',
  resumen:
    'Factura remitida por Suministros del Norte S.A.S. por la adquisición de 25 equipos de cómputo para la sede administrativa, según orden de compra OC-2026-0148.',
  clase: 'Original',
  creadoPor: 'Paola Suárez',
  creadoEl: '2026-09-25 08:41',
  flujo: 'Compras y pagos · v3',
  pasoActual: 'Revisión de Tesorería',
  nit: '900.123.456-1',
  entidad: 'Suministros del Norte S.A.S.',
  carpeta: 'Facturas / 2026 / Septiembre',
  comentarios: 'Verificar descuento por pronto pago del 3%.',
  anexos: [
    { nombre: 'factura_FE-88214.pdf', ext: 'pdf', peso: '1.2 MB', subidoPor: 'Paola Suárez', fecha: '2026-09-25 08:42' },
    { nombre: 'orden_compra_OC-0148.pdf', ext: 'pdf', peso: '640 KB', subidoPor: 'Paola Suárez', fecha: '2026-09-25 08:42' },
    { nombre: 'cuadro_comparativo.xlsx', ext: 'xls', peso: '208 KB', subidoPor: 'Mateo Arias', fecha: '2026-09-25 09:10' },
  ],
  historial: [
    { accion: 'Radicación creada', usuario: 'Paola Suárez', fecha: '2026-09-25 08:41', tono: 'azul', detalle: 'Origen Recibido · código 20260925300012' },
    { accion: 'Anexos cargados', usuario: 'Paola Suárez', fecha: '2026-09-25 08:42', tono: 'azul', detalle: '2 archivos (PDF)' },
    { accion: 'Enviado a flujo', usuario: 'Paola Suárez', fecha: '2026-09-25 08:45', tono: 'azul', detalle: 'Flujo Compras y pagos v3' },
    { accion: 'Aprobado', usuario: 'Mateo Arias', fecha: '2026-09-25 09:12', tono: 'verde', detalle: 'Pasó a Revisión de Tesorería · "Soportes verificados."' },
    { accion: 'Documento tomado', usuario: 'Andrés Molina', fecha: '2026-09-25 09:30', tono: 'ambar', detalle: 'Asignado exclusivamente a Andrés Molina' },
  ],
}

/* ---------------- Expediente central ---------------- */

export const expediente = [
  { id: 'e1', nombre: 'Subdirección Administrativa', tipo: 'area', count: 184, children: [
    { id: 'e1-1', nombre: 'Contratos', tipo: 'carpeta', count: 42, children: [
      { id: 'e1-1-1', nombre: 'Contratos 2026', tipo: 'carpeta', count: 18, children: [] },
      { id: 'e1-1-2', nombre: 'Contratos 2025', tipo: 'carpeta', count: 24, children: [] },
    ]},
    { id: 'e1-2', nombre: 'Actas', tipo: 'carpeta', count: 31, children: [] },
  ]},
  { id: 'e2', nombre: 'Contabilidad y Tesorería', tipo: 'area', count: 327, children: [
    { id: 'e2-1', nombre: 'Facturas', tipo: 'carpeta', count: 210, children: [
      { id: 'e2-1-1', nombre: 'Septiembre', tipo: 'carpeta', count: 64, children: [] },
      { id: 'e2-1-2', nombre: 'Agosto', tipo: 'carpeta', count: 71, children: [] },
    ]},
    { id: 'e2-2', nombre: 'Cuentas de cobro', tipo: 'carpeta', count: 88, children: [] },
    { id: 'e2-3', nombre: 'Pagos realizados', tipo: 'carpeta', count: 29, children: [] },
  ]},
  { id: 'e3', nombre: 'Gerencia General', tipo: 'area', count: 92, children: [
    { id: 'e3-1', nombre: 'Resoluciones', tipo: 'carpeta', count: 46, children: [] },
    { id: 'e3-2', nombre: 'Comités', tipo: 'carpeta', count: 46, children: [] },
  ]},
  { id: 'e4', nombre: 'Jurídica', tipo: 'area', count: 76, children: [
    { id: 'e4-1', nombre: 'Contratos', tipo: 'carpeta', count: 52, children: [] },
    { id: 'e4-2', nombre: 'Conceptos', tipo: 'carpeta', count: 24, children: [] },
  ]},
]

export const carpetaDetalle = {
  nombre: 'Facturas / Septiembre',
  documentos: [
    { codigo: '20260925300012', titulo: 'Solicitud de compra de equipos de cómputo', clase: 'Original', fecha: '2026-09-25', anexos: 3 },
    { codigo: '20260924300034', titulo: 'Factura de servicios públicos agosto', clase: 'Original', fecha: '2026-09-24', anexos: 2 },
    { codigo: '20260923300009', titulo: 'Cuenta de cobro honorarios septiembre', clase: 'Copia', fecha: '2026-09-23', anexos: 4 },
    { codigo: '20260920300077', titulo: 'Factura mantenimiento aire acondicionado', clase: 'Original', fecha: '2026-09-20', anexos: 2 },
  ],
}

/* ---------------- Plantillas ---------------- */

export const plantillas = [
  { id: 'PL-01', nombre: 'Orden de compra estándar', archivo: 'orden_compra.docx', origenes: ['Interno'], variables: 12, uso: 48, estado: 'Activa' },
  { id: 'PL-02', nombre: 'Contrato de prestación de servicios', archivo: 'contrato_ps.docx', origenes: ['Externo'], variables: 21, uso: 15, estado: 'Activa' },
  { id: 'PL-03', nombre: 'Memorando interno', archivo: 'memorando.docx', origenes: ['Interno'], variables: 7, uso: 112, estado: 'Activa' },
  { id: 'PL-04', nombre: 'Respuesta a correspondencia', archivo: 'respuesta_recibido.docx', origenes: ['Interno', 'Externo'], variables: 9, uso: 33, estado: 'En borrador' },
  { id: 'PL-05', nombre: 'Certificación laboral', archivo: 'certificacion.docx', origenes: ['Interno'], variables: 6, uso: 64, estado: 'Inactiva' },
]

export const plantillaDetalle = {
  nombre: 'Orden de compra estándar',
  archivo: 'orden_compra.docx',
  origenes: ['Interno'],
  variables: [
    { etiqueta: '{{codigo_radicado}}', descripcion: 'Código único del radicado', ejemplo: '20260925100008' },
    { etiqueta: '{{fecha}}', descripcion: 'Fecha de radicación', ejemplo: '2026-09-25' },
    { etiqueta: '{{titulo}}', descripcion: 'Título del documento', ejemplo: 'Compra de papelería' },
    { etiqueta: '{{area}}', descripcion: 'Área encargada', ejemplo: 'Compras y Proveedores' },
    { etiqueta: '{{nit}}', descripcion: 'NIT de la entidad', ejemplo: '900.123.456-1' },
    { etiqueta: '{{razon_social}}', descripcion: 'Razón social de la entidad', ejemplo: 'Suministros del Norte S.A.S.' },
    { etiqueta: '{{valor_total}}', descripcion: 'Valor total de la orden', ejemplo: '$ 42.500.000' },
    { etiqueta: '{{resumen}}', descripcion: 'Resumen del documento', ejemplo: 'Adquisición de papelería…' },
  ],
  preview: [
    'ORDEN DE COMPRA {{codigo_radicado}}',
    '',
    'Fecha: {{fecha}}',
    'Área solicitante: {{area}}',
    'Proveedor: {{razon_social}} — NIT {{nit}}',
    '',
    'Objeto: {{titulo}}',
    '{{resumen}}',
    '',
    'Valor total: {{valor_total}}',
  ],
}

/* ---------------- Flujos de trabajo ---------------- */

export const flujos = [
  { id: 'FL-01', nombre: 'Compras y pagos', descripcion: 'Circuito de aprobación de facturas y órdenes de compra.', version: 'v3', estado: 'Activo', nodos: 6, documentos: 84, autor: 'Laura Restrepo', modificado: '2026-09-20' },
  { id: 'FL-02', nombre: 'Contratación', descripcion: 'Revisión jurídica y firma de contratos.', version: 'v2', estado: 'Activo', nodos: 5, documentos: 37, autor: 'Diego Ramírez', modificado: '2026-09-12' },
  { id: 'FL-03', nombre: 'Viáticos y comisiones', descripcion: 'Aprobación de gastos de viaje por Gerencia.', version: 'v1', estado: 'Borrador', nodos: 4, documentos: 0, autor: 'Paola Suárez', modificado: '2026-09-24' },
  { id: 'FL-04', nombre: 'Correspondencia recibida', descripcion: 'Distribución de comunicaciones externas a las áreas.', version: 'v1', estado: 'Archivado', nodos: 3, documentos: 12, autor: 'Laura Restrepo', modificado: '2026-07-30' },
]

export const flujoDetalle = {
  id: 'FL-01',
  nombre: 'Compras y pagos',
  descripcion: 'Circuito de aprobación de facturas y órdenes de compra.',
  version: 'v3',
  estado: 'Activo',
  duracionMax: '10 días hábiles',
  nodos: [
    { id: 'n1', nombre: 'Radicación', tipo: 'inicio', asignacion: 'Rol · Radicador', duracion: '4 h', firma: false, x: 60, y: 40 },
    { id: 'n2', nombre: 'Revisión Compras', tipo: 'normal', asignacion: 'Área · Compras', duracion: '12 h', firma: false, x: 400, y: 40 },
    { id: 'n3', nombre: 'Revisión Tesorería', tipo: 'normal', asignacion: 'Rol · Tesorero', duracion: '8 h', firma: false, x: 740, y: 40 },
    { id: 'n4', nombre: 'Aprobación Gerencia', tipo: 'normal', asignacion: 'Grupo · Gerencia', duracion: '24 h', firma: true, x: 740, y: 200 },
    { id: 'n5', nombre: 'Pago programado', tipo: 'normal', asignacion: 'Rol · Tesorero', duracion: '48 h', firma: false, x: 400, y: 200 },
    { id: 'n6', nombre: 'Archivado', tipo: 'final', asignacion: 'Sistema · automático', duracion: 'Inmediato', firma: false, x: 60, y: 200 },
  ],
  transiciones: [
    { id: 't1', desde: 'n1', hasta: 'n2', accion: 'Aprobar' },
    { id: 't2', desde: 'n2', hasta: 'n3', accion: 'Aprobar' },
    { id: 't3', desde: 'n3', hasta: 'n4', accion: 'Aprobar' },
    { id: 't4', desde: 'n4', hasta: 'n5', accion: 'Aprobar' },
    { id: 't5', desde: 'n5', hasta: 'n6', accion: 'Aprobar' },
    { id: 't6', desde: 'n3', hasta: 'n2', accion: 'Devolver' },
    { id: 't7', desde: 'n2', hasta: 'n1', accion: 'Rechazar' },
  ],
  versiones: [
    { version: 'v3', fecha: '2026-09-20 10:12', autor: 'Laura Restrepo', estado: 'Vigente', nota: 'Se agregó validación de firma en Gerencia.' },
    { version: 'v2', fecha: '2026-08-14 15:40', autor: 'Laura Restrepo', estado: 'Histórica', nota: 'Nuevo estado de Pago programado.' },
    { version: 'v1', fecha: '2026-06-02 09:05', autor: 'Mateo Arias', estado: 'Histórica', nota: 'Versión inicial del circuito.' },
  ],
}

/* ---------------- Bandeja de entrada ---------------- */

export const bandeja = [
  { codigo: '20260925300012', titulo: 'Solicitud de compra de equipos de cómputo', tipo: 'Factura', origen: 'Recibido', area: 'Compras y Proveedores', vence: 'en 3 h', semaforo: 'rojo', asignado: null, estado: 'En revisión' },
  { codigo: '20260924200021', titulo: 'Contrato de prestación de servicios TI', tipo: 'Contrato', origen: 'Externo', area: 'Jurídica', vence: 'en 9 h', semaforo: 'ambar', asignado: 'Claudia Vega', estado: 'En firma' },
  { codigo: '20260924300034', titulo: 'Factura de servicios públicos agosto', tipo: 'Factura', origen: 'Recibido', area: 'Contabilidad y Tesorería', vence: 'en 1 día', semaforo: 'verde', asignado: null, estado: 'Radicado' },
  { codigo: '20260923300009', titulo: 'Cuenta de cobro honorarios septiembre', tipo: 'Cuenta de cobro', origen: 'Recibido', area: 'Contabilidad y Tesorería', vence: 'en 2 días', semaforo: 'verde', asignado: 'Andrés Molina', estado: 'Devuelto' },
  { codigo: '20260922100007', titulo: 'Acta de comité de compras', tipo: 'Acta', origen: 'Interno', area: 'Compras y Proveedores', vence: 'en 4 días', semaforo: 'verde', asignado: null, estado: 'Aprobado' },
]

export const copiasRecibidas = [
  { codigo: '20260924200021', titulo: 'Contrato de prestación de servicios TI', de: 'Diego Ramírez', fecha: '2026-09-24 15:22', nota: 'Copia informativa para Gerencia.' },
  { codigo: '20260920100055', titulo: 'Informe de gestión trimestral', de: 'Laura Restrepo', fecha: '2026-09-20 11:04', nota: 'Para conocimiento del comité.' },
  { codigo: '20260918000031', titulo: 'Resolución de nombramiento', de: 'Paola Suárez', fecha: '2026-09-18 09:48', nota: 'Copia para archivo de Gestión Humana.' },
]

/* ---------------- Bitácora y auditoría ---------------- */

export const bitacora = [
  { fecha: '2026-09-25 09:30:12', usuario: 'Andrés Molina', area: 'Contabilidad y Tesorería', accion: 'Documento tomado', documento: '20260925300012', tono: 'ambar', detalle: 'Se asignó exclusivamente el documento para su procesamiento.' },
  { fecha: '2026-09-25 09:12:44', usuario: 'Mateo Arias', area: 'Compras y Proveedores', accion: 'Aprobado', documento: '20260925300012', tono: 'verde', detalle: 'Aprobó la revisión de compras. Observación: "Soportes verificados."' },
  { fecha: '2026-09-25 08:45:03', usuario: 'Paola Suárez', area: 'Gestión Humana', accion: 'Enviado a flujo', documento: '20260925300012', tono: 'azul', detalle: 'Inició el flujo Compras y pagos v3.' },
  { fecha: '2026-09-25 08:42:18', usuario: 'Paola Suárez', area: 'Gestión Humana', accion: 'Anexo cargado', documento: '20260925300012', tono: 'azul', detalle: 'Cargó factura_FE-88214.pdf (1.2 MB).' },
  { fecha: '2026-09-25 08:41:07', usuario: 'Paola Suárez', area: 'Gestión Humana', accion: 'Radicación creada', documento: '20260925300012', tono: 'azul', detalle: 'Origen Recibido. Código asignado automáticamente.' },
  { fecha: '2026-09-24 16:20:55', usuario: 'Claudia Vega', area: 'Gerencia General', accion: 'Firma aplicada', documento: '20260924200021', tono: 'verde', detalle: 'Firmó electrónicamente el contrato (hash 8f2a…c41d).' },
  { fecha: '2026-09-24 15:22:31', usuario: 'Diego Ramírez', area: 'Jurídica', accion: 'Copia enviada', documento: '20260924200021', tono: 'azul', detalle: 'Envió copia a Claudia Vega.' },
  { fecha: '2026-09-23 11:48:09', usuario: 'Mateo Arias', area: 'Compras y Proveedores', accion: 'Rechazado', documento: '20260923100015', tono: 'rojo', detalle: 'Observación obligatoria: "Valor no coincide con la orden de compra."' },
  { fecha: '2026-09-23 10:02:47', usuario: 'Sofía Cárdenas', area: 'Contabilidad y Tesorería', accion: 'Devuelto', documento: '20260923300009', tono: 'rojo', detalle: 'Devolvió al estado anterior: "Falta firma del supervisor."' },
  { fecha: '2026-09-22 09:15:22', usuario: 'Laura Restrepo', area: 'Subdirección Administrativa', accion: 'Rol modificado', documento: '—', tono: 'gris', detalle: 'Actualizó permisos del rol Radicador.' },
]

export const accionesBitacora = [
  'Todas', 'Radicación creada', 'Anexo cargado', 'Enviado a flujo', 'Aprobado', 'Rechazado', 'Devuelto', 'Documento tomado', 'Firma aplicada', 'Copia enviada', 'Rol modificado',
]

/* ---------------- Panel (resumen) ---------------- */

export const resumen = {
  metricas: [
    { label: 'Radicados este mes', valor: '1.284', tono: 'azul', nota: '+8,4% frente a agosto', icono: 'documentos' },
    { label: 'En tránsito', valor: '57', tono: 'ambar', nota: '12 vencen hoy', icono: 'flujo' },
    { label: 'Pendientes por área', valor: '23', tono: 'rojo', nota: '4 con semáforo rojo', icono: 'bandeja' },
    { label: 'Documentos archivados', valor: '9.540', tono: 'verde', nota: 'Última copia: hoy 02:00', icono: 'archivo' },
  ],
  porArea: [
    { area: 'Contabilidad y Tesorería', valor: 327, max: 400 },
    { area: 'Compras y Proveedores', valor: 210, max: 400 },
    { area: 'Subdirección Administrativa', valor: 184, max: 400 },
    { area: 'Gestión Humana', valor: 141, max: 400 },
    { area: 'Gerencia General', valor: 92, max: 400 },
    { area: 'Jurídica', valor: 76, max: 400 },
  ],
  porEstado: [
    { estado: 'Aprobado', valor: 612, tono: 'verde' },
    { estado: 'En revisión', valor: 284, tono: 'ambar' },
    { estado: 'Radicado', valor: 246, tono: 'azul' },
    { estado: 'Devuelto', valor: 82, tono: 'rojo' },
  ],
  actividad: [
    { accion: 'Documento tomado', usuario: 'Andrés Molina', documento: '20260925300012', hora: '09:30' },
    { accion: 'Aprobado', usuario: 'Mateo Arias', documento: '20260925300012', hora: '09:12' },
    { accion: 'Firma aplicada', usuario: 'Claudia Vega', documento: '20260924200021', hora: 'ayer' },
    { accion: 'Rechazado', usuario: 'Mateo Arias', documento: '20260923100015', hora: '23 sep' },
    { accion: 'Rol modificado', usuario: 'Laura Restrepo', documento: '—', hora: '22 sep' },
  ],
}

/* ---------------- Rendimiento (transversal) ---------------- */

export const rendimiento = {
  metricas: [
    { label: 'Carga inicial (LCP)', valor: '1.24 s', meta: '< 2 s', ok: true, tono: 'verde' },
    { label: 'Transición de estado', valor: '0.38 s', meta: '< 2 s', ok: true, tono: 'verde' },
    { label: 'Usuarios concurrentes', valor: '120', meta: 'N = 120', ok: true, tono: 'azul' },
    { label: 'Tasa de error 5xx', valor: '0.02 %', meta: '< 0,5 %', ok: true, tono: 'verde' },
  ],
  rutas: [
    { ruta: 'Bandeja de entrada', lcp: 0.74, max: 2 },
    { ruta: 'Buscador de radicados', lcp: 1.06, max: 2 },
    { ruta: 'Expediente central', lcp: 1.24, max: 2 },
    { ruta: 'Diseñador de flujos', lcp: 1.61, max: 2 },
    { ruta: 'Bitácora y auditoría', lcp: 0.88, max: 2 },
  ],
  carga: [
    { escenario: '50 usuarios', p95: '0.62 s', errores: '0 %' },
    { escenario: '120 usuarios', p95: '1.18 s', errores: '0,02 %' },
    { escenario: '250 usuarios', p95: '1.94 s', errores: '0,11 %' },
  ],
}
