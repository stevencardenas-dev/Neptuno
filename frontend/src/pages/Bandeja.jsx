import { useState } from 'react'
import { Card, KV, Modal, Note, PageHead } from '../components/ui.jsx'
import { bandeja, copiasRecibidas } from '../data/mock.js'
import {
  IconCheck, IconCerrar, IconDevolver, IconFiltro, IconFirma,
  IconInfo, IconMovil, IconOjo, IconReloj, IconUsuarios, IconArchivo, IconPapelera,
} from '../components/Icons.jsx'

const origenBadge = { Interno: 'azul', Externo: 'violeta', Recibido: 'ambar', 'No radicable': 'gris' }

function Bandeja() {
  const [tab, setTab] = useState('pendientes')
  const [fTipo, setFTipo] = useState('Todos')
  const [orden, setOrden] = useState('Vencimiento')
  const [abierta, setAbierta] = useState(null)
  const [accion, setAccion] = useState(null)

  const tareas = bandeja.filter((t) => fTipo === 'Todos' || t.tipo === fTipo)

  return (
    <>
      <PageHead
        eyebrow="Bandeja de entrada y tareas pendientes"
        title="Mi bandeja"
        sub="Documentos pendientes de tu rol o área, con semáforo por tiempo restante. Toma, aprueba, rechaza o devuelve directamente."
        hu={['HU-042', 'HU-062', 'HU-063', 'HU-064', 'HU-065', 'HU-066', 'HU-067', 'HU-068', 'HU-070', 'HU-071', 'HU-074', 'HU-075', 'HU-083']}
        actions={[<button key="m" className="btn secondary" type="button"><IconMovil size={16} /> Vista móvil</button>]}
      />

      <div className="row between">
        <div className="tabs">
          <button className={`tab ${tab === 'pendientes' ? 'active' : ''}`} type="button" onClick={() => setTab('pendientes')}>Pendientes ({bandeja.length})</button>
          <button className={`tab ${tab === 'copias' ? 'active' : ''}`} type="button" onClick={() => setTab('copias')}>Copias recibidas ({copiasRecibidas.length})</button>
        </div>
        <div className="semaforo-legend">
          <span><span className="dot verde" /> A tiempo</span>
          <span><span className="dot ambar" /> Próximo a vencer</span>
          <span><span className="dot rojo" /> Vencido / crítico</span>
        </div>
      </div>

      {tab === 'pendientes' ? (
        <>
          <div className="toolbar mt-16">
            <label className="field" style={{ minWidth: 180 }}>
              <select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
                <option>Todos</option><option>Factura</option><option>Contrato</option><option>Cuenta de cobro</option><option>Acta</option>
              </select>
            </label>
            <label className="field" style={{ minWidth: 170 }}>
              <select value={orden} onChange={(e) => setOrden(e.target.value)}>
                <option>Vencimiento</option><option>Fecha</option><option>Tipo documental</option><option>Origen</option>
              </select>
            </label>
            <span className="badge azul" style={{ marginLeft: 'auto' }}><IconFiltro size={13} /> {orden}</span>
          </div>

          <div className="stack mt-16">
            {tareas.map((t) => (
              <div className={`task ${t.semaforo}`} key={t.codigo}>
                <span className="semaforo" />
                <div className="task-body">
                  <div className="row" style={{ gap: 8 }}>
                    <span className="code">{t.codigo}</span>
                    <span className={`badge ${origenBadge[t.origen]}`}>{t.origen}</span>
                    <span className="badge gris">{t.tipo}</span>
                  </div>
                  <h4 className="mt-8">{t.titulo}</h4>
                  <p>{t.area} · {t.estado}</p>
                </div>
                <div className="task-side">
                  <span className={`badge ${t.semaforo === 'rojo' ? 'rojo' : t.semaforo === 'ambar' ? 'ambar' : 'verde'}`}>
                    <IconReloj size={12} /> {t.vence}
                  </span>
                  {t.asignado ? (
                    <span className="badge azul"><IconUsuarios size={12} /> {t.asignado}</span>
                  ) : (
                    <button className="btn sm" type="button" onClick={() => setAccion({ tipo: 'tomar', t })}><IconUsuarios size={14} /> Tomar</button>
                  )}
                  <button className="btn ghost sm" type="button" onClick={() => setAbierta(t)}><IconOjo size={15} /> Abrir</button>
                </div>
              </div>
            ))}
            {!tareas.length ? <div className="empty">No hay tareas pendientes para el filtro seleccionado.</div> : null}
          </div>

          <Note icono={<IconInfo size={17} />}>
            Mientras un documento esté <strong>en posesión</strong> de un usuario, ningún otro puede editarlo
            ni tomar el original, evitando ediciones simultáneas.
          </Note>
        </>
      ) : (
        <div className="stack mt-16">
          {copiasRecibidas.map((c) => (
            <div className="task verde" key={c.codigo}>
              <span className="semaforo" />
              <div className="task-body">
                <div className="row" style={{ gap: 8 }}>
                  <span className="code">{c.codigo}</span>
                  <span className="badge ambar">Copia</span>
                </div>
                <h4 className="mt-8">{c.titulo}</h4>
                <p>Enviada por {c.de} · {c.fecha}</p>
              </div>
              <div className="task-side">
                <span className="badge gris">{c.nota}</span>
                <button className="btn ghost sm" type="button"><IconOjo size={15} /> Consultar</button>
              </div>
            </div>
          ))}
          <Note icono={<IconInfo size={17} />}>
            Las copias se muestran en una sección separada y no bloquean el avance del radicado original.
          </Note>
        </div>
      )}

      {/* Detalle de la tarea */}
      <Modal
        open={!!abierta}
        title={abierta?.titulo ?? ''}
        sub={`${abierta?.codigo} · ${abierta?.area}`}
        onClose={() => setAbierta(null)}
        ancho="720px"
        footer={[
          <button key="d" className="btn danger" type="button" onClick={() => setAccion({ tipo: 'rechazar', t: abierta })}><IconCerrar size={16} /> Rechazar</button>,
          <button key="v" className="btn secondary" type="button" onClick={() => setAccion({ tipo: 'devolver', t: abierta })}><IconDevolver size={16} /> Devolver</button>,
          <button key="a" className="btn" type="button" onClick={() => setAccion({ tipo: 'aprobar', t: abierta })}><IconCheck size={16} /> Aprobar</button>,
        ]}
      >
        <KV items={[
          { k: 'Origen', v: abierta?.origen },
          { k: 'Tipo documental', v: abierta?.tipo },
          { k: 'Estado actual', v: abierta?.estado },
          { k: 'Vence', v: abierta?.vence },
        ]} />
        <div>
          <span className="muted small">Anexos del documento</span>
          <div className="stack mt-8" style={{ gap: 10 }}>
            <div className="chip-file">
              <span className="ext pdf">PDF</span>
              <div className="meta"><strong>documento_principal.pdf</strong><small>1.4 MB · original</small></div>
              <button className="btn ghost sm" type="button"><IconArchivo size={15} /></button>
            </div>
            <div className="chip-file">
              <span className="ext xls">XLS</span>
              <div className="meta"><strong>soporte_calculo.xlsx</strong><small>220 KB</small></div>
              <button className="btn ghost sm" type="button"><IconArchivo size={15} /></button>
            </div>
          </div>
        </div>
        <div className="field">
          <label>Observación <span className="muted">(obligatoria para rechazar o devolver)</span></label>
          <textarea placeholder="Describe el motivo…" />
        </div>
      </Modal>

      {/* Confirmación de acciones */}
      <Modal
        open={!!accion}
        title={
          accion?.tipo === 'aprobar' ? 'Aprobar documento'
            : accion?.tipo === 'rechazar' ? 'Rechazar documento'
              : accion?.tipo === 'devolver' ? 'Devolver al estado anterior'
                : 'Tomar el documento'
        }
        sub={accion?.t?.codigo}
        onClose={() => setAccion(null)}
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setAccion(null)}>Cancelar</button>,
          <button key="ok" className={`btn ${accion?.tipo === 'rechazar' ? 'danger' : ''}`} type="button" onClick={() => setAccion(null)}>
            {accion?.tipo === 'aprobar' ? <><IconCheck size={16} /> Aprobar</> : accion?.tipo === 'rechazar' ? <><IconCerrar size={16} /> Rechazar</> : accion?.tipo === 'devolver' ? <><IconDevolver size={16} /> Devolver</> : <><IconUsuarios size={16} /> Asignarme el documento</>}
          </button>,
        ]}
      >
        {accion?.tipo === 'aprobar' ? (
          <Note icono={<IconFirma size={17} />}>
            Este paso <strong>exige firma electrónica</strong>. Al aprobar se registrará tu firma
            con sello de tiempo en la bitácora (HU-075).
          </Note>
        ) : accion?.tipo === 'tomar' ? (
          <Note icono={<IconUsuarios size={17} />}>
            Quedarás como responsable exclusivo del documento hasta que lo liberes o completes la tarea.
          </Note>
        ) : (
          <div className="field">
            <label>Observación <span className="req">*</span></label>
            <textarea placeholder="Motivo obligatorio…" />
          </div>
        )}
        {accion?.tipo !== 'tomar' ? (
          <label className="switch"><input type="checkbox" /> Aplicar firma electrónica ahora</label>
        ) : null}
      </Modal>

      <p className="muted small mt-16" style={{ textAlign: 'center' }}>
        <IconPapelera size={13} /> Los documentos se procesan solo desde tu bandeja asignada.
      </p>
    </>
  )
}

export default Bandeja
