import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, KV, Modal, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import { listarAreas, listarTiposDocumentales } from '../api/catalogos.js'
import { listarRoles } from '../api/roles.js'
import { listarUsuarios } from '../api/usuarios.js'
import {
  agregarPaso,
  agregarTransicion,
  asignarResponsable,
  crearVersionFlujo,
  asignarTiposDeFlujo,
  desactivarFlujo,
  descartarBorradorFlujo,
  editarPaso,
  grafoFlujo,
  marcarPaso,
  publicarFlujo,
  quitarResponsable,
  reactivarFlujo,
  retirarPaso,
  retirarTransicion,
  tiposDeFlujo,
  versionesFlujo,
} from '../api/workflow.js'
import { formatearFechaHora } from '../util/formato.js'
import {
  IconCheck,
  IconEditar,
  IconFlecha,
  IconFlujo,
  IconInfo,
  IconMas,
  IconPapelera,
  IconUsuarios,
} from '../components/Icons.jsx'

/**
 * Lienzo del flujo (HU-052) con todo lo que lo define: pasos y su marca de inicial o
 * final (HU-053, HU-054, HU-055), transiciones (HU-056, HU-057, HU-058), responsables
 * (HU-059, HU-060), publicación (HU-061) y archivo del flujo (HU-050).
 *
 * El dibujo es SVG sin librerías: los pasos se arrastran, se conectan y se editan en el
 * panel de la derecha, y cada cambio se guarda al confirmarlo.
 */

const ANCHO_PASO = 190
const ALTO_PASO = 68

const TIPOS = [
  { valor: 'INICIAL', etiqueta: 'Inicial', ayuda: 'Donde empieza el trámite' },
  { valor: 'INTERMEDIO', etiqueta: 'Intermedio', ayuda: 'Un paso de trámite' },
  { valor: 'FINAL', etiqueta: 'Final', ayuda: 'Donde termina el trámite' },
]

const ACCIONES = [
  { valor: 'APROBAR', etiqueta: 'Aprobar' },
  { valor: 'DEVOLVER', etiqueta: 'Devolver' },
  { valor: 'CANCELAR', etiqueta: 'Cancelar' },
  { valor: 'ENVIAR', etiqueta: 'Enviar' },
]

const SUJETOS = [
  { valor: 'ROL', etiqueta: 'Un rol' },
  { valor: 'AREA', etiqueta: 'Un área' },
  { valor: 'USUARIO', etiqueta: 'Un usuario' },
]

/**
 * Nombre visible de un responsable: «Tesorero · rol». El tipo importa porque un rol y un
 * área pueden llamarse igual; sin nombre en el catálogo se dice qué tipo quedó sin identificar.
 */
function nombreResponsable(catalogos, responsable) {
  const tipo = etiqueta(SUJETOS, responsable.tipoSujeto).replace('Un ', '')
  const encontrado = catalogos.nombres.get(`${responsable.tipoSujeto}:${responsable.sujetoId}`)
  return encontrado ? `${encontrado} · ${tipo}` : `${tipo} sin identificar`
}

const ESTADOS_FLUJO = {
  BORRADOR: { etiqueta: 'Borrador', tono: 'gris' },
  ACTIVO: { etiqueta: 'En operación', tono: 'verde' },
  INACTIVO: { etiqueta: 'Archivado', tono: 'ambar' },
}

const TONO_VERSION = { BORRADOR: 'ambar', PUBLICADA: 'verde', REEMPLAZADA: 'gris' }

function etiquetaEstadoVersion(version) {
  if (version.estado === 'BORRADOR') return 'Borrador'
  if (version.vigente) return 'En operación'
  return 'Reemplazada'
}

const etiquetaVersion = (version) => `Versión ${version.numero} · ${etiquetaEstadoVersion(version)}`

function nombreUsuario(catalogos, id) {
  if (!id) return '—'
  return catalogos.nombres.get(`USUARIO:${id}`) ?? 'Usuario no disponible'
}

const etiqueta = (lista, valor) => lista.find((item) => item.valor === valor)?.etiqueta ?? valor
const recortar = (texto, limite = 24) => (texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto)

/** Centro del paso en el lienzo. */
const centro = (paso) => ({ x: paso.posicionX + ANCHO_PASO / 2, y: paso.posicionY + ALTO_PASO / 2 })

/** Punto donde la línea que une dos centros corta el borde del rectángulo. */
function borde(paso, hacia) {
  const desde = centro(paso)
  const dx = hacia.x - desde.x
  const dy = hacia.y - desde.y
  const escala = Math.min(
    dx ? (ANCHO_PASO / 2 + 6) / Math.abs(dx) : Infinity,
    dy ? (ALTO_PASO / 2 + 6) / Math.abs(dy) : Infinity,
    1,
  )
  return { x: desde.x + dx * escala, y: desde.y + dy * escala }
}

/** Convierte la posición del puntero a coordenadas del lienzo. */
function puntoEnLienzo(svg, evento) {
  const caja = svg.getBoundingClientRect()
  return { x: evento.clientX - caja.left, y: evento.clientY - caja.top }
}

/** HU-052: el flujo dibujado, con sus pasos arrastrables y sus transiciones. */
function Lienzo({ grafo, seleccion, editable, onSeleccionar, onMover }) {
  const [arrastre, setArrastre] = useState(null)
  const [suelto, setSuelto] = useState(null)

  const pasos = grafo.pasos.map((paso) =>
    suelto && suelto.id === paso.id ? { ...paso, posicionX: suelto.x, posicionY: suelto.y } : paso,
  )
  const porId = new Map(pasos.map((paso) => [paso.id, paso]))
  const ancho = Math.max(900, ...pasos.map((paso) => paso.posicionX + ANCHO_PASO)) + 80
  const alto = Math.max(420, ...pasos.map((paso) => paso.posicionY + ALTO_PASO)) + 80

  function bajar(evento, paso) {
    onSeleccionar(paso.id)
    if (!editable) return
    evento.currentTarget.setPointerCapture?.(evento.pointerId)
    const punto = puntoEnLienzo(evento.currentTarget.ownerSVGElement, evento)
    setArrastre({ id: paso.id, dx: punto.x - paso.posicionX, dy: punto.y - paso.posicionY })
    setSuelto({ id: paso.id, x: paso.posicionX, y: paso.posicionY })
  }

  function mover(evento) {
    if (!arrastre) return
    const punto = puntoEnLienzo(evento.currentTarget, evento)
    setSuelto({
      id: arrastre.id,
      x: Math.max(0, Math.round((punto.x - arrastre.dx) / 10) * 10),
      y: Math.max(0, Math.round((punto.y - arrastre.dy) / 10) * 10),
    })
  }

  function soltar() {
    if (!arrastre || !suelto) return
    const antes = grafo.pasos.find((paso) => paso.id === arrastre.id)
    setArrastre(null)
    setSuelto(null)
    if (antes && (antes.posicionX !== suelto.x || antes.posicionY !== suelto.y)) {
      onMover(arrastre.id, suelto.x, suelto.y)
    }
  }

  return (
    <div className="lienzo" role="group" aria-label={`Lienzo del flujo ${grafo.flujo}`}>
      <svg
        width={ancho}
        height={alto}
        viewBox={`0 0 ${ancho} ${alto}`}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        onClick={(evento) => { if (evento.target === evento.currentTarget) onSeleccionar(null) }}
        style={{ touchAction: 'none' }}
      >
        <defs>
          <marker id="flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="lienzo-flecha" />
          </marker>
        </defs>

        {grafo.transiciones.map((transicion) => {
          const origen = porId.get(transicion.estadoOrigenId)
          const destino = porId.get(transicion.estadoDestinoId)
          if (!origen || !destino) return null
          const inicio = borde(origen, centro(destino))
          const fin = borde(destino, centro(origen))
          const medio = { x: (inicio.x + fin.x) / 2, y: (inicio.y + fin.y) / 2 }
          return (
            <g key={transicion.id} className="lienzo-transicion">
              <line x1={inicio.x} y1={inicio.y} x2={fin.x} y2={fin.y} markerEnd="url(#flecha)" />
              <rect x={medio.x - 38} y={medio.y - 11} width="76" height="22" rx="4" className="lienzo-etiqueta-fondo" />
              <text x={medio.x} y={medio.y + 4} className="lienzo-etiqueta">
                {recortar(transicion.etiqueta ?? etiqueta(ACCIONES, transicion.accion), 12)}
              </text>
            </g>
          )
        })}

        {pasos.map((paso) => {
          const marcado = seleccion === paso.id
          return (
            <g
              key={paso.id}
              className={`lienzo-paso tipo-${paso.tipo.toLowerCase()}${marcado ? ' marcado' : ''}`}
              onPointerDown={(evento) => bajar(evento, paso)}
              role="button"
              tabIndex={0}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter' || evento.key === ' ') {
                  evento.preventDefault()
                  onSeleccionar(paso.id)
                }
              }}
              onFocus={() => onSeleccionar(paso.id)}
              aria-label={`Paso ${paso.nombre}, ${etiqueta(TIPOS, paso.tipo)}`}
            >
              <rect x={paso.posicionX} y={paso.posicionY} width={ANCHO_PASO} height={ALTO_PASO} rx="8" />
              <text x={paso.posicionX + 16} y={paso.posicionY + 28} className="lienzo-titulo">
                {recortar(paso.nombre)}
              </text>
              <text x={paso.posicionX + 16} y={paso.posicionY + 47} className="lienzo-detalle">
                {etiqueta(TIPOS, paso.tipo)}
                {paso.responsables.length ? ` · ${paso.responsables.length} responsable${paso.responsables.length === 1 ? '' : 's'}` : ''}
              </text>
            </g>
          )
        })}

        {!pasos.length ? (
          <text x={ancho / 2} y={alto / 2} className="lienzo-vacio">
            Este flujo todavía no tiene pasos
          </text>
        ) : null}
      </svg>

      <div className="lienzo-ayuda">
        <span className="muted small">
          {editable ? 'Arrastra un paso para ubicarlo; haz clic para editarlo.' : 'El flujo está publicado: el recorrido se consulta, no se edita.'}
        </span>
      </div>
    </div>
  )
}

/** Formulario de un paso nuevo (HU-053). */
function FormularioPasoNuevo({ onCerrar, onGuardar, guardando, error }) {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState('INTERMEDIO')

  return (
    <form
      id="form-paso"
      className="stack"
      onSubmit={(evento) => {
        evento.preventDefault()
        onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, tipo })
      }}
    >
      <div className="row between">
        <h4 className="panel-titulo">Nuevo paso</h4>
        <button className="btn ghost sm" type="button" onClick={onCerrar}>Cancelar</button>
      </div>

      <label className="field">
        <span className="k">Nombre del paso</span>
        <input
          id="paso-nombre"
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Por ejemplo: Revisión jurídica"
        />
      </label>

      <label className="field">
        <span className="k">Descripción</span>
        <textarea
          id="paso-descripcion"
          rows="2"
          maxLength={500}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Qué se hace en este paso (opcional)"
        />
      </label>

      <div className="field">
        <span className="k">Tipo de paso</span>
        <div className="opciones" role="radiogroup" aria-label="Tipo de paso">
          {TIPOS.map((opcion) => (
            <label className="switch" key={opcion.valor} title={opcion.ayuda}>
              <input type="radio" name="paso-tipo" value={opcion.valor} checked={tipo === opcion.valor} onChange={() => setTipo(opcion.valor)} />
              <span>{opcion.etiqueta}</span>
            </label>
          ))}
        </div>
      </div>

      {error ? <div className="error-message">{error.message}</div> : null}

      <button className="btn" type="submit" disabled={guardando}>
        <IconMas size={16} /> {guardando ? 'Agregando…' : 'Agregar paso'}
      </button>
    </form>
  )
}

/** Ficha del paso seleccionado: datos, transiciones y responsables. */
function FormularioPaso({ grafo, paso, catalogos, guardando, error, onGuardar, onRetirar, onVolver }) {
  const [nombre, setNombre] = useState(paso.nombre)
  const [descripcion, setDescripcion] = useState(paso.descripcion ?? '')
  const [sujeto, setSujeto] = useState('ROL')
  const [sujetoId, setSujetoId] = useState('')
  const [accion, setAccion] = useState('APROBAR')
  const [destino, setDestino] = useState('')
  const [etiquetaTransicion, setEtiquetaTransicion] = useState('')

  useEffect(() => {
    setNombre(paso.nombre)
    setDescripcion(paso.descripcion ?? '')
  }, [paso.id, paso.nombre, paso.descripcion])

  const salidas = grafo.transiciones.filter((transicion) => transicion.estadoOrigenId === paso.id)
  const otros = grafo.pasos.filter((otro) => otro.id !== paso.id)
  const libres = ACCIONES.filter((opcion) => !salidas.some((transicion) => transicion.accion === opcion.valor))

  const nombreSujeto = (responsable) => nombreResponsable(catalogos, responsable)

  return (
    <div className="stack">
      <div className="row between">
        <h4 className="panel-titulo">{paso.tipo === 'INICIAL' ? 'Paso inicial' : paso.tipo === 'FINAL' ? 'Paso final' : 'Paso'}</h4>
        <button className="btn ghost sm" type="button" onClick={onVolver}>← Volver</button>
      </div>

      <form
        className="stack"
        onSubmit={(evento) => {
          evento.preventDefault()
          onGuardar('datos', { nombre: nombre.trim(), descripcion: descripcion.trim() || null })
        }}
      >
        <label className="field">
          <span className="k">Nombre</span>
          <input
            id="paso-nombre"
            type="text"
            required
            minLength={2}
            maxLength={80}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="k">Descripción</span>
          <textarea id="paso-descripcion" rows="2" maxLength={500} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>

        <div className="field">
          <span className="k">Tipo de paso</span>
          <div className="opciones" role="radiogroup" aria-label="Tipo de paso">
            {TIPOS.map((opcion) => (
              <label className="switch" key={opcion.valor} title={opcion.ayuda}>
                <input
                  type="radio"
                  name="paso-tipo"
                  value={opcion.valor}
                  checked={paso.tipo === opcion.valor}
                  onChange={() => onGuardar('tipo', opcion.valor)}
                />
                <span>{opcion.etiqueta}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" type="submit" disabled={guardando}>
            <IconEditar size={15} /> Guardar datos
          </button>
          <button className="btn danger sm" type="button" onClick={onRetirar}>
            <IconPapelera size={15} /> Retirar paso
          </button>
        </div>
      </form>

      <div className="panel-seccion">
        <h5 className="panel-sub">Salidas de este paso</h5>
        {salidas.length ? (
          <ul className="lista-simple">
            {salidas.map((transicion) => {
              const hacia = grafo.pasos.find((otro) => otro.id === transicion.estadoDestinoId)
              return (
                <li key={transicion.id}>
                  <span className="badge azul">{transicion.etiqueta ?? etiqueta(ACCIONES, transicion.accion)}</span>
                  <span className="muted small">→ {hacia?.nombre ?? 'paso desconocido'}</span>
                  <button
                    className="btn ghost sm"
                    type="button"
                    title="Eliminar la transición"
                    onClick={() => onGuardar('quitarTransicion', transicion.id)}
                    disabled={guardando}
                  >
                    <IconPapelera size={14} />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted small">Este paso no lleva a ningún otro.</p>
        )}

        {libres.length && otros.length ? (
          <form
            className="stack"
            onSubmit={(evento) => {
              evento.preventDefault()
              onGuardar('transicion', {
                estadoOrigenId: paso.id,
                estadoDestinoId: destino,
                accion,
                etiqueta: etiquetaTransicion.trim() || null,
              })
            }}
          >
            <div className="field-row">
              <label className="field">
                <span className="k">Con la acción</span>
                <select id="transicion-accion" value={accion} onChange={(e) => setAccion(e.target.value)}>
                  {libres.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="k">Lleva al paso</span>
                <select id="transicion-destino" value={destino} onChange={(e) => setDestino(e.target.value)} required>
                  <option value="">Selecciona el paso…</option>
                  {otros.map((otro) => (
                    <option key={otro.id} value={otro.id}>{otro.nombre}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span className="k">Texto del botón</span>
              <input
                id="transicion-etiqueta"
                type="text"
                maxLength={80}
                value={etiquetaTransicion}
                onChange={(e) => setEtiquetaTransicion(e.target.value)}
                placeholder="Opcional: cómo se verá la acción en la bandeja"
              />
            </label>
            <button className="btn secondary sm" type="submit" disabled={guardando || !destino}>
              <IconMas size={15} /> Agregar salida
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel-seccion">
        <h5 className="panel-sub">
          <IconUsuarios size={14} /> Quién atiende este paso
        </h5>
        {paso.responsables.length ? (
          <ul className="lista-simple">
            {paso.responsables.map((responsable) => (
              <li key={responsable.id}>
                <span>{nombreSujeto(responsable)}</span>
                <button
                  className="btn ghost sm"
                  type="button"
                  title="Quitar el responsable"
                  onClick={() => onGuardar('quitarResponsable', responsable.id)}
                  disabled={guardando}
                >
                  <IconPapelera size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Nadie tiene asignado este paso todavía.</p>
        )}

        <form
          className="stack"
          onSubmit={(evento) => {
            evento.preventDefault()
            onGuardar('responsable', { tipoSujeto: sujeto, sujetoId })
          }}
        >
          <div className="field-row">
            <label className="field">
              <span className="k">Asignar</span>
              <select id="responsable-tipo" value={sujeto} onChange={(e) => { setSujeto(e.target.value); setSujetoId('') }}>
                {SUJETOS.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="k">{sujeto === 'ROL' ? 'Rol' : sujeto === 'USUARIO' ? 'Usuario' : 'Área'}</span>
              <select id="responsable-sujeto" value={sujetoId} onChange={(e) => setSujetoId(e.target.value)} required>
                <option value="">Selecciona…</option>
                {(sujeto === 'ROL' ? catalogos.roles : sujeto === 'USUARIO' ? catalogos.usuarios : catalogos.areas).map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn secondary sm" type="submit" disabled={guardando || !sujetoId}>
            <IconMas size={15} /> Asignar responsable
          </button>
        </form>
      </div>

      {error ? (
        <div className="error-message">
          {error.message}
          {error.detalles?.length ? (
            <div className="detalles">
              {error.detalles.map((detalle) => <span key={detalle}>· {detalle}</span>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Ficha de un paso cuando el flujo está publicado: se consulta, no se edita. */
function FichaPasoLectura({ grafo, paso, catalogos }) {
  const salidas = grafo.transiciones.filter((transicion) => transicion.estadoOrigenId === paso.id)
  const nombreSujeto = (responsable) => nombreResponsable(catalogos, responsable)

  return (
    <div className="stack">
      <KV
        items={[
          { k: 'Paso', v: paso.nombre },
          { k: 'Tipo', v: etiqueta(TIPOS, paso.tipo) },
          { k: 'Descripción', v: paso.descripcion || '—' },
        ]}
      />

      <div className="panel-seccion">
        <h5 className="panel-sub">Salidas de este paso</h5>
        {salidas.length ? (
          <ul className="lista-simple">
            {salidas.map((transicion) => {
              const hacia = grafo.pasos.find((otro) => otro.id === transicion.estadoDestinoId)
              return (
                <li key={transicion.id}>
                  <span className="badge azul">{transicion.etiqueta ?? etiqueta(ACCIONES, transicion.accion)}</span>
                  <span className="muted small">→ {hacia?.nombre ?? 'paso desconocido'}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted small">Este paso no lleva a ningún otro.</p>
        )}
      </div>

      <div className="panel-seccion">
        <h5 className="panel-sub">
          <IconUsuarios size={14} /> Quién atiende este paso
        </h5>
        {paso.responsables.length ? (
          <ul className="lista-simple">
            {paso.responsables.map((responsable) => (
              <li key={responsable.id}>
                <span>{nombreSujeto(responsable)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Nadie tiene asignado este paso.</p>
        )}
      </div>
    </div>
  )
}

/**
 * Tipos documentales que atiende el flujo: quien radica un documento de esos tipos puede
 * elegir este flujo. Se guarda aparte del recorrido, así que también se edita con el flujo
 * publicado.
 */
function TiposDocumentalesFlujo({ flujoId }) {
  const tipos = usePeticion(() => listarTiposDocumentales(), [])
  const vinculados = usePeticion(() => tiposDeFlujo(flujoId), [flujoId])
  const [seleccion, setSeleccion] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)

  const actuales = seleccion ?? vinculados.datos?.tipoDocumentalIds ?? []
  const lista = (tipos.datos ?? []).filter((tipo) => tipo.estado === 'ACTIVO' || actuales.includes(tipo.id))

  function alternar(id) {
    setGuardado(false)
    setSeleccion(actuales.includes(id) ? actuales.filter((otro) => otro !== id) : [...actuales, id])
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await asignarTiposDeFlujo(flujoId, actuales)
      setGuardado(true)
      vinculados.recargar()
      setSeleccion(null)
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card title="Tipos documentales" sub="Los documentos de estos tipos podrán iniciar su trámite con este flujo al radicarse" icono={<IconFlujo size={17} />}>
      {tipos.error || vinculados.error ? <div className="error-message">No se pudieron cargar los tipos documentales.</div> : null}
      <div className="opciones" role="group" aria-label="Tipos documentales del flujo">
        {lista.map((tipo) => (
          <label key={tipo.id} className="switch">
            <input type="checkbox" checked={actuales.includes(tipo.id)} onChange={() => alternar(tipo.id)} />
            {tipo.nombre}
          </label>
        ))}
        {!lista.length && !tipos.cargando ? <p className="muted small">No hay tipos documentales activos.</p> : null}
      </div>
      {error ? <div className="error-message mt-8">{error.message}</div> : null}
      <div className="row mt-8" style={{ gap: 8, alignItems: 'center' }}>
        <button className="btn secondary sm" type="button" disabled={guardando || seleccion === null} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar tipos'}
        </button>
        {guardado ? <span className="muted small">Guardado.</span> : null}
      </div>
    </Card>
  )
}

export default function DisenadorFlujo() {
  const { id } = useParams()
  const [grafo, setGrafo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [seleccion, setSeleccion] = useState(null)
  const [nuevoPaso, setNuevoPaso] = useState(false)
  const [confirmar, setConfirmar] = useState(null)
  const [versiones, setVersiones] = useState([])

  const roles = usePeticion(() => listarRoles(), [])
  const areas = usePeticion(() => listarAreas({ soloActivas: true }), [])
  const usuarios = usePeticion(() => listarUsuarios({ estado: 'ACTIVO', tamano: 100 }), [])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    versionesFlujo(id).then((lista) => vigente && setVersiones(lista)).catch(() => {})
    grafoFlujo(id)
      .then((datos) => {
        if (!vigente) return
        setGrafo(datos)
        setErrorCarga('')
      })
      .catch((fallo) => {
        if (vigente) setErrorCarga(fallo.message)
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => { vigente = false }
  }, [id])

  const catalogos = useMemo(() => {
    const nombres = new Map()
    for (const rol of roles.datos ?? []) nombres.set(`ROL:${rol.id}`, rol.nombre)
    for (const area of areas.datos ?? []) nombres.set(`AREA:${area.id}`, area.nombre)
    const personas = usuarios.datos?.contenido ?? []
    for (const persona of personas) nombres.set(`USUARIO:${persona.id}`, persona.nombre)
    return { nombres, roles: roles.datos ?? [], areas: areas.datos ?? [], usuarios: personas }
  }, [roles.datos, areas.datos, usuarios.datos])

  /** HU-080: el historial se vuelve a pedir tras cada cambio que pueda crear o cerrar una versión. */
  function recargarVersiones() {
    versionesFlujo(id).then(setVersiones).catch(() => {})
  }

  /** HU-080: mostrar otra versión del flujo; solo el borrador se puede editar. */
  async function verVersion(numero) {
    setGuardando(true)
    setError(null)
    try {
      setGrafo(await grafoFlujo(id, numero))
      setSeleccion(null)
      setNuevoPaso(false)
    } catch (fallo) {
      setError(fallo)
    } finally {
      setGuardando(false)
    }
  }

  /** Cada cambio vuelve con el lienzo ya actualizado: una sola respuesta para todo. */
  async function ejecutar(accion) {
    setGuardando(true)
    setError(null)
    try {
      setGrafo(await accion())
      recargarVersiones()
      return true
    } catch (fallo) {
      setError(fallo)
      return false
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <p className="muted mt-16">Cargando el flujo…</p>
  if (errorCarga) return <div className="error-message mt-16">{errorCarga}</div>

  const estado = ESTADOS_FLUJO[grafo.estadoFlujo] ?? { etiqueta: grafo.estadoFlujo, tono: 'gris' }
  const paso = grafo.pasos.find((candidato) => candidato.id === seleccion) ?? null
  const soloLectura = !grafo.editable
  const borradorNuevo = !soloLectura && grafo.versionEnOperacion !== null
  const borradorAbierto = versiones.find((version) => version.estado === 'BORRADOR') ?? null
  const estaVersion = grafo.version ? versiones.find((version) => version.numero === grafo.version.numero) : null

  return (
    <>
      <PageHead
        title={grafo.flujo}
        sub="Así circula un documento: los pasos que recorre, las decisiones que lo mueven y quién atiende cada paso."
        actions={
          <>
            <Link className="btn secondary" to="/app/flujos">
              <IconFlecha size={15} /> Volver a flujos
            </Link>
            {!soloLectura ? (
              <button className="btn" type="button" disabled={guardando} onClick={() => ejecutar(() => publicarFlujo(id))}>
                <IconCheck size={16} /> Publicar flujo
              </button>
            ) : null}
            {borradorNuevo ? (
              <button className="btn secondary" type="button" disabled={guardando} onClick={() => setConfirmar('borrador')}>
                <IconPapelera size={15} /> Descartar borrador
              </button>
            ) : null}
            {soloLectura && grafo.estadoFlujo !== 'INACTIVO' && !borradorAbierto ? (
              <button className="btn" type="button" disabled={guardando} onClick={() => ejecutar(() => crearVersionFlujo(id))}>
                <IconMas size={16} /> Crear nueva versión
              </button>
            ) : null}
            {grafo.estadoFlujo === 'INACTIVO' ? (
              <button className="btn secondary" type="button" disabled={guardando} onClick={() => ejecutar(() => reactivarFlujo(id))}>
                Reactivar
              </button>
            ) : (
              <button className="btn secondary" type="button" disabled={guardando} onClick={() => setConfirmar('archivar')}>
                Archivar
              </button>
            )}
          </>
        }
      />

      <div className="row mt-8" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className={`badge ${estado.tono}`}>{estado.etiqueta}</span>
        {borradorNuevo ? <span className="badge ambar">Editando la versión {grafo.version.numero} (borrador)</span> : null}
        {versiones.length > 1 && grafo.version ? (
          <label className="field" style={{ minWidth: 230, marginLeft: 'auto' }}>
            <span className="k">Ver versión</span>
            <select value={grafo.version.numero} disabled={guardando} onChange={(e) => verVersion(Number(e.target.value))}>
              {versiones.map((version) => (
                <option key={version.id} value={version.numero}>
                  {etiquetaVersion(version)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <span className="badge gris">
          {grafo.version ? `Versión ${grafo.version.numero} · ${grafo.pasos.length} paso${grafo.pasos.length === 1 ? '' : 's'} · ${grafo.transiciones.length} transición${grafo.transiciones.length === 1 ? '' : 'es'}` : 'Sin pasos todavía'}
        </span>
        {roles.error || areas.error ? <span className="badge ambar">El catálogo de roles y áreas no respondió</span> : null}
      </div>

      {error && error.codigo === 'FLUJO_INCOMPLETO' ? (
        <div className="error-message mt-16" role="alert">
          {error.message}
          <div className="detalles">
            {error.detalles.map((detalle) => <span key={detalle}>· {detalle}</span>)}
          </div>
        </div>
      ) : null}

      {borradorNuevo ? (
        <div className="mt-16">
          <Note icono={<IconInfo size={17} />}>
            Estás editando la versión {grafo.version.numero}, un borrador. La versión {grafo.versionEnOperacion} sigue
            en operación y los trámites nuevos la usan hasta que publiques este borrador.
          </Note>
        </div>
      ) : null}

      {soloLectura && borradorAbierto && estaVersion?.estado !== 'BORRADOR' ? (
        <div className="mt-16">
          <Note icono={<IconInfo size={17} />}>
            Estás consultando la versión {grafo.version.numero}
            {estaVersion?.vigente ? ', que es la que está en operación' : ', que ya fue reemplazada'}. Hay un
            borrador abierto (versión {borradorAbierto.numero}): elígelo en «Ver versión» para seguir editándolo.
          </Note>
        </div>
      ) : null}

      {soloLectura && !(borradorAbierto && estaVersion?.estado !== 'BORRADOR') ? (
        <div className="mt-16">
          <Note icono={<IconInfo size={17} />}>
            {estaVersion && !estaVersion.vigente && estaVersion.estado === 'REEMPLAZADA'
              ? `La versión ${grafo.version.numero} ya fue reemplazada: se consulta, no se edita.`
              : null}
            {estaVersion && !estaVersion.vigente && estaVersion.estado === 'REEMPLAZADA' ? ' ' : null}
            Este flujo está publicado: su recorrido no se edita mientras esté en operación, para que los
            trámites que ya empezaron no cambien de camino. Para cambiarlo, crea una versión nueva: se
            abre un borrador con una copia del recorrido y la versión actual sigue en operación hasta que
            publiques el borrador.
          </Note>
        </div>
      ) : null}

      <div className="grid grid-lienzo mt-16">
        <Card title="Lienzo del flujo" sub={grafo.version ? `Versión ${grafo.version.numero} ${soloLectura ? 'publicada' : 'en borrador'}` : 'Sin pasos todavía'} icono={<IconFlujo size={17} />}>
          <Lienzo
            grafo={grafo}
            seleccion={seleccion}
            editable={!soloLectura}
            onSeleccionar={(pasoId) => { setNuevoPaso(false); setSeleccion(pasoId) }}
            onMover={(pasoId, x, y) => ejecutar(() => editarPaso(id, pasoId, { posicionX: x, posicionY: y }))}          />
        </Card>

        <Card title={soloLectura && paso ? 'Detalle del paso' : nuevoPaso ? 'Nuevo paso' : paso ? 'Editar paso' : 'Resumen del flujo'} icono={<IconInfo size={17} />}>
          {soloLectura ? (
            paso ? (
              <FichaPasoLectura grafo={grafo} paso={paso} catalogos={catalogos} />
            ) : (
              <div className="stack">
                <KV
                  items={[
                    { k: 'Pasos', v: `${grafo.pasos.length}` },
                    { k: 'Transiciones', v: `${grafo.transiciones.length}` },
                    { k: 'Personas asignadas', v: `${grafo.pasos.reduce((total, actual) => total + actual.responsables.length, 0)}` },
                    { k: 'Versión publicada', v: grafo.version ? `${grafo.version.numero}` : '—' },
                  ]}
                />
                <p className="muted small">
                  Selecciona un paso del lienzo para consultar quién lo atiende y qué decisiones admite.
                </p>
              </div>
            )
          ) : nuevoPaso ? (
            <FormularioPasoNuevo
              guardando={guardando}
              error={error}
              onCerrar={() => setNuevoPaso(false)}
              onGuardar={async (datos) => {
                if (await ejecutar(() => agregarPaso(id, datos))) setNuevoPaso(false)
              }}
            />
          ) : paso ? (
            <FormularioPaso
              key={paso.id}
              grafo={grafo}
              paso={paso}
              catalogos={catalogos}
              guardando={guardando}
              error={error}
              onRetirar={() => setConfirmar('paso')}
              onVolver={() => setSeleccion(null)}
              onGuardar={(que, datos) => {
                if (que === 'datos') return ejecutar(() => editarPaso(id, paso.id, datos))
                if (que === 'tipo') return ejecutar(() => marcarPaso(id, paso.id, datos))
                if (que === 'transicion') return ejecutar(() => agregarTransicion(id, datos))
                if (que === 'quitarTransicion') return ejecutar(() => retirarTransicion(id, datos))
                if (que === 'responsable') return ejecutar(() => asignarResponsable(id, paso.id, datos))
                if (que === 'quitarResponsable') return ejecutar(() => quitarResponsable(id, paso.id, datos))
                return Promise.resolve(false)
              }}
            />
          ) : (
            <div className="stack">
              <KV
                items={[
                  { k: 'Pasos', v: `${grafo.pasos.length}` },
                  { k: 'Transiciones', v: `${grafo.transiciones.length}` },
                  { k: 'Personas asignadas', v: `${grafo.pasos.reduce((total, actual) => total + actual.responsables.length, 0)}` },
                ]}
              />
              <p className="muted small">
                Un flujo completo tiene un paso inicial, al menos uno final y ningún paso suelto. Cuando lo
                esté, publícalo para ponerlo en operación.
              </p>
              <button className="btn" type="button" onClick={() => { setSeleccion(null); setNuevoPaso(true) }}>
                <IconMas size={16} /> {grafo.pasos.length ? 'Agregar paso' : 'Agregar el primer paso'}
              </button>
            </div>
          )}

          {!nuevoPaso && paso && !soloLectura ? (
            <p className="muted small mt-8">
              Arrastra el paso en el lienzo para moverlo · guardado {guardando ? 'en curso…' : 'automático'}
            </p>
          ) : null}
        </Card>
      </div>

      {versiones.length ? (
        <div className="mt-16">
          <Card title="Historial de versiones" sub="Quién y cuándo creó y publicó cada versión" icono={<IconFlujo size={17} />}>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Versión</th>
                    <th>Estado</th>
                    <th>Pasos</th>
                    <th>Creada</th>
                    <th>Publicada</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {versiones.map((version) => (
                    <tr key={version.id}>
                      <td><strong>Versión {version.numero}</strong></td>
                      <td>
                        <span className={`badge ${TONO_VERSION[version.estado] ?? 'gris'}`}>{etiquetaEstadoVersion(version)}</span>
                      </td>
                      <td className="muted">{version.pasos}</td>
                      <td className="muted">
                        {formatearFechaHora(version.creadoEn)}
                        <span className="cell-sub">{nombreUsuario(catalogos, version.creadoPor)}</span>
                      </td>
                      <td className="muted">
                        {version.publicadoEn ? formatearFechaHora(version.publicadoEn) : '—'}
                        {version.publicadoPor ? <span className="cell-sub">{nombreUsuario(catalogos, version.publicadoPor)}</span> : null}
                      </td>
                      <td>
                        <button
                          className="btn secondary"
                          type="button"
                          disabled={guardando || grafo.version?.numero === version.numero}
                          onClick={() => verVersion(version.numero)}
                        >
                          {grafo.version?.numero === version.numero ? 'Viendo' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mt-16">
        <TiposDocumentalesFlujo flujoId={id} />
      </div>

      <Modal
        open={confirmar === 'borrador'}
        title="Descartar el borrador"
        sub={grafo.version ? `Se elimina la versión ${grafo.version.numero}` : ''}
        onClose={() => setConfirmar(null)}
        ancho="560px"
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setConfirmar(null)}>Cancelar</button>,
          <button
            key="d"
            className="btn danger"
            type="button"
            disabled={guardando}
            onClick={async () => {
              await ejecutar(() => descartarBorradorFlujo(id))
              setConfirmar(null)
              setSeleccion(null)
            }}
          >
            <IconPapelera size={16} /> Descartar borrador
          </button>,
        ]}
      >
        <Note tono="rojo" icono={<IconInfo size={17} />}>
          Se pierden los cambios del borrador. La versión {grafo.versionEnOperacion} sigue en operación y no se toca.
        </Note>
        {error ? <div className="error-message mt-16">{error.message}</div> : null}
      </Modal>

      <Modal
        open={confirmar === 'archivar'}
        title="Archivar el flujo"
        sub="Se retira de la operación sin borrar su historia"
        onClose={() => setConfirmar(null)}
        ancho="560px"
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setConfirmar(null)}>Cancelar</button>,
          <button
            key="a"
            className="btn danger"
            type="button"
            disabled={guardando}
            onClick={async () => {
              await ejecutar(() => desactivarFlujo(id))
              setConfirmar(null)
            }}
          >
            <IconPapelera size={16} /> Archivar flujo
          </button>,
        ]}
      >
        <Note tono="rojo" icono={<IconInfo size={17} />}>
          El flujo dejará de estar disponible para iniciar trámites nuevos. La definición y la bitácora
          se conservan, y puedes reactivarlo cuando lo necesites.
        </Note>
        {error ? <div className="error-message mt-16">{error.message}</div> : null}
      </Modal>

      <Modal
        open={confirmar === 'paso'}
        title="Retirar el paso"
        sub={paso ? `Se retira «${paso.nombre}» del flujo` : ''}
        onClose={() => setConfirmar(null)}
        ancho="560px"
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setConfirmar(null)}>Cancelar</button>,
          <button
            key="r"
            className="btn danger"
            type="button"
            disabled={guardando}
            onClick={async () => {
              const retirado = await ejecutar(() => retirarPaso(id, paso.id))
              setConfirmar(null)
              if (retirado) setSeleccion(null)
            }}
          >
            <IconPapelera size={16} /> Retirar paso
          </button>,
        ]}
      >
        <Note tono="rojo" icono={<IconInfo size={17} />}>
          Se retiran también las transiciones que entran y salen de este paso. Las demás quedan intactas.
        </Note>
        {error ? <div className="error-message mt-16">{error.message}</div> : null}
      </Modal>
    </>
  )
}
