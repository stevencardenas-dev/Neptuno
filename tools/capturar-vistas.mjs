/**
 * Captura todas las vistas de Neptuno y las guarda en capturas/.
 *
 * Cada imagen lleva un encabezado con el nombre de la vista y las historias de
 * usuario que cubre. Si una vista es más alta que el alto máximo por captura,
 * se parte automáticamente y se enumera (parte 1 de N, parte 2 de N, ...).
 *
 * Uso:
 *   node tools/capturar-vistas.mjs            # usa http://localhost:5178
 *   NEPTUNO_URL=http://localhost:5173 node tools/capturar-vistas.mjs
 *
 * No usa dependencias: maneja Chrome por el protocolo DevTools (CDP) usando el
 * WebSocket que ya trae Node.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.NEPTUNO_URL ?? 'http://localhost:5178'
const ANCHO = 1440
const ALTO_VIEWPORT = 900
const MAX_ALTO_PARTE = 1150
const PUERTO_CDP = 9333
const PERFIL = path.join(process.env.TEMP ?? '/tmp', 'neptuno-captura-perfil')
const SALIDA = path.resolve(process.cwd(), 'capturas')

/* ---------------------------------------------------------------------------
   Vistas a capturar
   --------------------------------------------------------------------------- */
const VISTAS = [
  { slug: '01-indice-de-mockups', titulo: 'Índice de mockups (portada)', hu: 'Referencia general del prototipo', ruta: '/', host: '.content' },
  { slug: '02-autenticacion-y-acceso', titulo: 'Autenticación y acceso', hu: 'HU-001, HU-002', ruta: '/login', host: '.auth-card' },
  { slug: '03-panel-general', titulo: 'Panel general', hu: 'Resumen operativo (transversal)', ruta: '/app' },
  { slug: '04-radicacion-de-documentos', titulo: 'Radicación de documentos', hu: 'HU-017 … HU-041', ruta: '/app/radicacion' },
  { slug: '05-consulta-y-buscador', titulo: 'Consulta y buscador de radicados', hu: 'HU-020, HU-023, HU-028', ruta: '/app/radicados' },
  { slug: '06-bandeja-tareas-pendientes', titulo: 'Bandeja de entrada y tareas pendientes', hu: 'HU-042, HU-062 … HU-068, HU-070, HU-071, HU-074, HU-075, HU-083', ruta: '/app/bandeja' },
  { slug: '07-bandeja-copias-recibidas', titulo: 'Bandeja de entrada · copias recibidas', hu: 'HU-042', ruta: '/app/bandeja', click: 'Copias recibidas' },
  { slug: '08-expediente-central', titulo: 'Expediente central (archivo)', hu: 'HU-030 … HU-033', ruta: '/app/expediente' },
  { slug: '09-usuarios-listado', titulo: 'Administración de usuarios', hu: 'HU-003 … HU-006, HU-012', ruta: '/app/usuarios' },
  { slug: '10-usuarios-crear', titulo: 'Administración de usuarios · crear usuario', hu: 'HU-003, HU-012', ruta: '/app/usuarios', click: 'Nuevo usuario', soloViewport: true },
  { slug: '11-roles-y-permisos', titulo: 'Roles y permisos', hu: 'HU-007 … HU-011', ruta: '/app/roles' },
  { slug: '12-roles-asignar-permisos', titulo: 'Roles y permisos · asignar permisos a un rol', hu: 'HU-011', ruta: '/app/roles', click: 'Editar permisos', soloViewport: true },
  { slug: '13-parametros-tipos-documentales', titulo: 'Parámetros del sistema · tipos documentales', hu: 'HU-015', ruta: '/app/configuracion' },
  { slug: '14-parametros-areas', titulo: 'Parámetros del sistema · áreas', hu: 'HU-016', ruta: '/app/configuracion', click: 'Áreas' },
  { slug: '15-parametros-entidades', titulo: 'Parámetros del sistema · entidades', hu: 'HU-022', ruta: '/app/configuracion', click: 'Entidades' },
  { slug: '16-parametros-copias-de-seguridad', titulo: 'Parámetros del sistema · copias de seguridad', hu: 'HU-081, HU-082', ruta: '/app/configuracion', click: 'Copias de seguridad' },
  { slug: '17-gestion-de-plantillas', titulo: 'Gestión de plantillas y renderizado', hu: 'HU-035 … HU-038', ruta: '/app/plantillas' },
  { slug: '18-flujos-lienzo', titulo: 'Diseñador de flujos de trabajo · lienzo', hu: 'HU-048 … HU-061, HU-069, HU-072, HU-073, HU-076, HU-078 … HU-080', ruta: '/app/flujos' },
  { slug: '19-flujos-listado', titulo: 'Diseñador de flujos de trabajo · listado de flujos', hu: 'HU-048 … HU-051', ruta: '/app/flujos', click: 'Listado de flujos' },
  { slug: '20-flujos-versiones', titulo: 'Diseñador de flujos de trabajo · versiones', hu: 'HU-078 … HU-080', ruta: '/app/flujos', click: 'Versiones' },
  { slug: '21-bitacora-y-auditoria', titulo: 'Bitácora y auditoría', hu: 'HU-043 … HU-047, HU-077', ruta: '/app/bitacora' },
  { slug: '22-rendimiento', titulo: 'Rendimiento (requisitos transversales)', hu: 'HU-084, HU-085', ruta: '/app/rendimiento' },
]

/* ---------------------------------------------------------------------------
   Navegador
   --------------------------------------------------------------------------- */
const CANDIDATOS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function esperarPuerto() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/version`)
      if (r.ok) return r.json()
    } catch {
      /* el navegador aún no está listo */
    }
    await sleep(250)
  }
  throw new Error('El navegador no expuso el puerto de depuración')
}

/* Cliente CDP mínimo sobre WebSocket */
class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pendientes = new Map()
    this.escuchas = []
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pendientes.has(msg.id)) {
        const { resolver, rechazar } = this.pendientes.get(msg.id)
        this.pendientes.delete(msg.id)
        if (msg.error) rechazar(new Error(JSON.stringify(msg.error)))
        else resolver(msg.result)
      } else {
        this.escuchas.forEach((fn) => fn(msg))
      }
    }
  }

  static async conectar(url) {
    const ws = new WebSocket(url)
    await new Promise((resolver, rechazar) => {
      ws.onopen = resolver
      ws.onerror = () => rechazar(new Error('No se pudo abrir el WebSocket de CDP'))
    })
    return new Cdp(ws)
  }

  enviar(method, params = {}, sessionId) {
    const id = (this.id += 1)
    const msg = { id, method, params }
    if (sessionId) msg.sessionId = sessionId
    this.ws.send(JSON.stringify(msg))
    return new Promise((resolver, rechazar) => this.pendientes.set(id, { resolver, rechazar }))
  }

  unaVez(evento, timeout = 20000) {
    return new Promise((resolver, rechazar) => {
      const t = setTimeout(() => {
        this.escuchas = this.escuchas.filter((f) => f !== fn)
        rechazar(new Error(`Timeout esperando ${evento}`))
      }, timeout)
      const fn = (m) => {
        if (m.method !== evento) return
        clearTimeout(t)
        this.escuchas = this.escuchas.filter((f) => f !== fn)
        resolver(m.params)
      }
      this.escuchas.push(fn)
    })
  }
}

/* ---------------------------------------------------------------------------
   Utilidades de página
   --------------------------------------------------------------------------- */
const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const HOST_POR_DEFECTO = "document.querySelector('.content') || document.querySelector('.auth-card') || document.body"

function htmlBanner(vista, parte, total) {
  return `
  <div id="cap-titulo" style="margin:0 0 20px;padding:16px 20px;border-radius:18px;background:linear-gradient(120deg,#2f6bff 0%,#7b53ff 52%,#ff3b4e 100%);color:#fff;box-shadow:0 18px 40px -24px rgba(47,107,255,.9)">
    <div style="font:600 11px/1.2 Inter,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;opacity:.85">Neptuno · Sistema de Gestión Documental</div>
    <div style="font:700 22px/1.15 'Space Grotesk',Inter,system-ui,sans-serif;margin-top:6px">${escapar(vista.titulo)}</div>
    <div style="font:500 12.5px/1.5 Inter,system-ui,sans-serif;margin-top:6px;opacity:.95">Historias de usuario cubiertas: ${escapar(vista.hu)}</div>
    <div style="font:400 11px/1.5 Inter,system-ui,sans-serif;margin-top:3px;opacity:.82">Captura ${parte} de ${total} · Ruta ${escapar(vista.ruta)}</div>
  </div>`
}

/* ---------------------------------------------------------------------------
   Proceso principal
   --------------------------------------------------------------------------- */
async function main() {
  const bin = CANDIDATOS.find((p) => existsSync(p))
  if (!bin) throw new Error('No se encontró Chrome ni Edge en las rutas habituales')

  await rm(PERFIL, { recursive: true, force: true })
  await mkdir(SALIDA, { recursive: true })

  console.log(`Navegador : ${bin}`)
  console.log(`Sitio     : ${BASE}`)
  console.log(`Salida    : ${SALIDA}\n`)

  const navegador = spawn(
    bin,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--remote-allow-origins=*',
      `--remote-debugging-port=${PUERTO_CDP}`,
      `--user-data-dir=${PERFIL}`,
      `--window-size=${ANCHO},${ALTO_VIEWPORT}`,
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  )

  const { webSocketDebuggerUrl } = await esperarPuerto()
  const cdp = await Cdp.conectar(webSocketDebuggerUrl)
  const { targetId } = await cdp.enviar('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.enviar('Target.attachToTarget', { targetId, flatten: true })

  await cdp.enviar('Page.enable', {}, sessionId)
  await cdp.enviar('Runtime.enable', {}, sessionId)
  await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: ANCHO, height: ALTO_VIEWPORT, deviceScaleFactor: 1, mobile: false }, sessionId)

  async function evaluar(expression) {
    const r = await cdp.enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
    return r.result.value
  }

  const resultados = []

  for (const vista of VISTAS) {
    process.stdout.write(`· ${vista.slug} `)
    await cdp.enviar('Page.navigate', { url: BASE + vista.ruta }, sessionId)
    await cdp.unaVez('Page.loadEventFired').catch(() => {})
    await evaluar('document.fonts.ready.then(() => true)').catch(() => {})
    await sleep(700)

    // Estilos de captura: la barra lateral y la superior dejan de ser "sticky"
    // para que la foto de página completa no deje franjas en blanco.
    await evaluar(`(() => {
      const prev = document.getElementById('cap-estilo')
      if (prev) prev.remove()
      const s = document.createElement('style')
      s.id = 'cap-estilo'
      s.textContent = '.sidebar{position:static !important;height:auto !important;min-height:100vh}.topbar{position:static !important}'
      document.head.appendChild(s)
      return true
    })()`)

    // Interacción opcional (cambiar de pestaña, abrir un modal...)
    let encontrado = true
    if (vista.click) {
      encontrado = await evaluar(`(() => {
        const objetivo = ${JSON.stringify(vista.click)}
        const botones = [...document.querySelectorAll('button, a')]
        const el = botones.find((b) => b.textContent.trim().includes(objetivo))
        if (el) el.click()
        return !!el
      })()`)
      await sleep(600)
    }
    if (!encontrado) console.log(`(aviso: no se encontró el control "${vista.click}")`)

    await evaluar('window.scrollTo(0, 0)')

    // Modales: solo se captura la ventana visible.
    if (vista.soloViewport) {
      await evaluar(`(() => {
        const prev = document.getElementById('cap-titulo'); if (prev) prev.remove()
        const host = ${vista.host ? `document.querySelector(${JSON.stringify(vista.host)})` : HOST_POR_DEFECTO}
        const t = document.createElement('template'); t.innerHTML = ${JSON.stringify(htmlBanner(vista, 1, 1))}
        host.insertBefore(t.content.firstElementChild, host.firstChild)
        return true
      })()`)
      await sleep(250)
      const { data } = await cdp.enviar('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: ANCHO, height: ALTO_VIEWPORT, scale: 1 },
      }, sessionId)
      const archivo = `${vista.slug}.png`
      await writeFile(path.join(SALIDA, archivo), Buffer.from(data, 'base64'))
      resultados.push({ archivo, vista, parte: 1, total: 1 })
      console.log('→ 1 captura')
      continue
    }

    // Se reparten los bloques visibles en páginas de alto máximo. Se baja
    // recursivamente por los contenedores .stack para partir con más detalle.
    const bloques = await evaluar(`(() => {
      const host = ${vista.host ? `document.querySelector(${JSON.stringify(vista.host)})` : HOST_POR_DEFECTO}
      const hojas = []
      const recorrer = (el) => {
        if (el.id === 'cap-titulo') return
        if (el.classList.contains('stack')) { [...el.children].forEach(recorrer); return }
        hojas.push(el)
      }
      ;[...host.children].forEach(recorrer)
      hojas.forEach((el, i) => { el.dataset.capId = String(i) })
      return hojas.map((el, i) => {
        const r = el.getBoundingClientRect()
        return { i, top: Math.round(r.top + window.scrollY), h: Math.round(r.height) }
      })
    })()`)

    const partes = []
    let actual = null
    for (const b of bloques) {
      if (!actual) actual = { indices: [], top: b.top, bottom: b.top + b.h }
      else if (b.top + b.h - actual.top > MAX_ALTO_PARTE) {
        partes.push(actual)
        actual = { indices: [], top: b.top, bottom: b.top + b.h }
      } else {
        actual.bottom = b.top + b.h
      }
      actual.indices.push(b.i)
    }
    if (actual && actual.indices.length) partes.push(actual)
    if (!partes.length) partes.push({ indices: [] })

    for (let p = 0; p < partes.length; p += 1) {
      const parte = partes[p]
      const total = partes.length

      // Se ocultan los bloques que no pertenecen a esta captura.
      await evaluar(`(() => {
        const host = ${vista.host ? `document.querySelector(${JSON.stringify(vista.host)})` : HOST_POR_DEFECTO}
        const visibles = ${JSON.stringify(parte.indices)}
        document.querySelectorAll('[data-cap-id]').forEach((el) => {
          el.style.display = visibles.includes(Number(el.dataset.capId)) ? '' : 'none'
        })
        const prev = document.getElementById('cap-titulo'); if (prev) prev.remove()
        const t = document.createElement('template'); t.innerHTML = ${JSON.stringify(htmlBanner(vista, p + 1, total))}
        host.insertBefore(t.content.firstElementChild, host.firstChild)
        window.scrollTo(0, 0)
        return true
      })()`)
      await sleep(250)

      const metricas = await cdp.enviar('Page.getLayoutMetrics', {}, sessionId)
      const tamano = metricas.cssContentSize ?? metricas.contentSize
      const alto = Math.max(200, Math.min(Math.ceil(tamano.height), 6000))

      const { data } = await cdp.enviar('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: ANCHO, height: alto, scale: 1 },
      }, sessionId)

      const archivo = total === 1 ? `${vista.slug}.png` : `${vista.slug}-parte-${p + 1}.png`
      await writeFile(path.join(SALIDA, archivo), Buffer.from(data, 'base64'))
      resultados.push({ archivo, vista, parte: p + 1, total })
    }
    console.log(`→ ${partes.length} captura(s)`)
  }

  // Índice de capturas
  const filas = resultados
    .map((r) => `| \`${r.archivo}\` | ${r.vista.titulo} | ${r.vista.hu} | ${r.vista.ruta} | ${r.total > 1 ? `${r.parte} de ${r.total}` : '1 de 1'} |`)
    .join('\n')

  const indice = `# Capturas de las vistas de Neptuno

Generadas automáticamente con \`node tools/capturar-vistas.mjs\` (Chrome headless
por CDP, sin dependencias). Cada imagen incluye en su encabezado el nombre de la
vista y las historias de usuario que cubre. Las vistas más altas se parten en
varias capturas, numeradas como "parte N de M".

Para regenerarlas con el frontend levantado:

\`\`\`bash
cd frontend && npm run dev        # http://localhost:5173
cd ..
NEPTUNO_URL=http://localhost:5173 node tools/capturar-vistas.mjs
\`\`\`

## Índice

| Archivo | Vista | Historias de usuario | Ruta | Captura |
|---------|-------|----------------------|------|---------|
${filas}

## Trazabilidad completa

La relación de las 85 historias de usuario con cada vista está en
[\`../docs/MATRIZ-VISTAS-HU.md\`](../docs/MATRIZ-VISTAS-HU.md).
`
  await writeFile(path.join(SALIDA, 'README.md'), indice, 'utf8')

  navegador.kill()
  console.log(`\nListo: ${resultados.length} capturas en capturas/`)
}

main().catch((e) => {
  console.error('\nError:', e.message)
  process.exit(1)
})
