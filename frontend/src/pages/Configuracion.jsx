import { useState } from 'react'
import { Card, KV, Modal, Note, PageHead } from '../components/ui.jsx'
import { areas, entidades, respaldos, tiposDocumentales } from '../data/mock.js'
import {
  IconArchivo, IconCalendario, IconCheck, IconConfig, IconEditar, IconGlobo,
  IconInfo, IconMas, IconPapelera, IconDescargar, IconGuardar, IconEscudo,
  IconSubir, IconReloj,
} from '../components/Icons.jsx'

const tabs = [
  { id: 'tipos', label: 'Tipos documentales' },
  { id: 'areas', label: 'Áreas' },
  { id: 'entidades', label: 'Entidades' },
  { id: 'respaldos', label: 'Copias de seguridad' },
]

function Configuracion() {
  const [tab, setTab] = useState('tipos')
  const [modal, setModal] = useState(null)

  return (
    <>
      <PageHead
        eyebrow="Configuración y parámetros del sistema"
        title="Parámetros"
        sub="Administra los catálogos que estructuran la radicación: tipos documentales, áreas, entidades y copias de seguridad."
        hu={['HU-015', 'HU-016', 'HU-022', 'HU-081', 'HU-082']}
        actions={[
          <button key="n" className="btn" type="button" onClick={() => setModal(tab)}><IconMas size={16} /> Agregar</button>,
        ]}
      />

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} type="button" onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="mt-16">
        {tab === 'tipos' ? (
          <Card title="Tipos documentales" sub="Clasifican cada radicado" icono={<IconArchivo size={17} />} tight>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Nombre</th><th>Prefijo</th><th>Orígenes permitidos</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                <tbody>
                  {tiposDocumentales.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.nombre}</strong><span className="cell-sub">{t.id}</span></td>
                      <td><span className="code">{t.prefijo}</span></td>
                      <td><div className="row" style={{ gap: 6 }}>{t.origenes.map((o) => <span className="badge gris" key={o}>{o}</span>)}</div></td>
                      <td><span className={`badge ${t.estado === 'Activo' ? 'verde' : 'gris'}`}><span className={`dot ${t.estado === 'Activo' ? 'verde' : 'gris'}`} /> {t.estado}</span></td>
                      <td><div className="td-actions">
                        <button className="btn ghost sm" type="button" title="Editar"><IconEditar size={15} /></button>
                        <button className="btn ghost sm" type="button" title={t.estado === 'Activo' ? 'Desactivar' : 'Activar'}><IconPapelera size={15} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {tab === 'areas' ? (
          <Card title="Áreas de la organización" sub="Asignan cada documento y usuario al área correspondiente" icono={<IconGlobo size={17} />} tight>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Área</th><th>Responsable</th><th>Documentos</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                <tbody>
                  {areas.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.nombre}</strong><span className="cell-sub">{a.id}</span></td>
                      <td>{a.responsable}</td>
                      <td><span className="badge azul">{a.documentos}</span></td>
                      <td><span className={`badge ${a.estado === 'Activa' ? 'verde' : 'gris'}`}><span className={`dot ${a.estado === 'Activa' ? 'verde' : 'gris'}`} /> {a.estado}</span></td>
                      <td><div className="td-actions">
                        <button className="btn ghost sm" type="button" title="Editar"><IconEditar size={15} /></button>
                        <button className="btn ghost sm" type="button" title="Desactivar"><IconPapelera size={15} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {tab === 'entidades' ? (
          <Card
            title="Entidades"
            sub="NIT y razón social requeridos para radicar origen Recibido o generar origen Externo"
            icono={<IconEscudo size={17} />}
            actions={<button className="btn secondary sm" type="button" onClick={() => setModal('entidades')}><IconMas size={15} /> Nueva entidad</button>}
            tight
          >
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>NIT</th><th>Razón social</th><th>Ciudad</th><th>Tipo</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                <tbody>
                  {entidades.map((e) => (
                    <tr key={e.nit}>
                      <td><span className="code">{e.nit}</span></td>
                      <td><strong>{e.razonSocial}</strong></td>
                      <td>{e.ciudad}</td>
                      <td><span className="badge gris">{e.tipo}</span></td>
                      <td><span className={`badge ${e.estado === 'Activa' ? 'verde' : 'gris'}`}><span className={`dot ${e.estado === 'Activa' ? 'verde' : 'gris'}`} /> {e.estado}</span></td>
                      <td><div className="td-actions">
                        <button className="btn ghost sm" type="button" title="Editar"><IconEditar size={15} /></button>
                        <button className="btn ghost sm" type="button" title="Eliminar"><IconPapelera size={15} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {tab === 'respaldos' ? (
          <div className="grid grid-side">
            <Card title="Historial de copias de seguridad" sub="Documentos y bitácora" icono={<IconArchivo size={17} />} tight>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Identificador</th><th>Tipo</th><th>Tamaño</th><th>Contenido</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                  <tbody>
                    {respaldos.map((b) => (
                      <tr key={b.id}>
                        <td><strong>{b.id}</strong><span className="cell-sub">{b.fecha}</span></td>
                        <td><span className="badge gris">{b.tipo}</span></td>
                        <td>{b.tamano}</td>
                        <td className="muted small">{b.documentos} documentos · {b.bitacora}</td>
                        <td><span className={`badge ${b.estado === 'Completado' ? 'verde' : 'ambar'}`}><span className={`dot ${b.estado === 'Completado' ? 'verde' : 'ambar'}`} /> {b.estado}</span></td>
                        <td><div className="td-actions">
                          <button className="btn ghost sm" type="button" title="Restaurar"><IconSubir size={15} /></button>
                          <button className="btn ghost sm" type="button" title="Descargar"><IconDescargar size={15} /></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="stack">
              <Card title="Programación" sub="Copias automáticas" icono={<IconCalendario size={17} />}>
                <div className="field">
                  <label>Frecuencia</label>
                  <select defaultValue="Diaria"><option>Diaria</option><option>Cada 12 horas</option><option>Semanal</option></select>
                </div>
                <div className="field-row mt-16">
                  <div className="field"><label>Hora</label><input type="text" defaultValue="02:00" /></div>
                  <div className="field"><label>Retención</label><input type="text" defaultValue="30 días" /></div>
                </div>
                <label className="switch mt-16"><input type="checkbox" defaultChecked /> Incluir bitácora de auditoría</label>
                <button className="btn block mt-16" type="button"><IconGuardar size={16} /> Guardar programación</button>
              </Card>

              <Card title="Restaurar" sub="Recupera documentos y bitácora" icono={<IconSubir size={17} />}>
                <Note icono={<IconInfo size={17} />}>
                  La restauración reemplaza el contenido actual por el de la copia seleccionada.
                  Se registra en la bitácora y requiere confirmación.
                </Note>
                <div className="field mt-16">
                  <label>Copia a restaurar</label>
                  <select>{respaldos.map((b) => <option key={b.id}>{b.id} · {b.fecha}</option>)}</select>
                </div>
                <button className="btn danger block mt-16" type="button"><IconReloj size={16} /> Restaurar copia</button>
              </Card>
            </div>
          </div>
        ) : null}
      </div>

      <Note icono={<IconConfig size={17} />}>
        Los catálogos permiten <strong>crear, editar y desactivar</strong> registros sin borrar el
        histórico, de modo que los radicados existentes conservan su clasificación original.
      </Note>

      <Modal
        open={!!modal}
        title="Agregar registro"
        sub="Añade un nuevo elemento al catálogo"
        onClose={() => setModal(null)}
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setModal(null)}>Cancelar</button>,
          <button key="g" className="btn" type="button" onClick={() => setModal(null)}><IconCheck size={16} /> Guardar</button>,
        ]}
      >
        {modal === 'areas' ? (
          <div className="field"><label>Nombre del área <span className="req">*</span></label><input type="text" placeholder="Ej. Planeación" /></div>
        ) : modal === 'entidades' ? (
          <>
            <div className="field-row">
              <div className="field"><label>NIT <span className="req">*</span></label><input type="text" placeholder="900.000.000-0" /></div>
              <div className="field"><label>Razón social <span className="req">*</span></label><input type="text" placeholder="Nombre de la entidad" /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Ciudad</label><input type="text" placeholder="Bogotá" /></div>
              <div className="field"><label>Tipo</label><select><option>Proveedor</option><option>Entidad pública</option><option>Cliente</option></select></div>
            </div>
          </>
        ) : (
          <>
            <div className="field-row">
              <div className="field"><label>Nombre <span className="req">*</span></label><input type="text" placeholder="Ej. Orden de servicio" /></div>
              <div className="field"><label>Prefijo</label><input type="text" placeholder="OS" /></div>
            </div>
            <div className="field">
              <label>Orígenes permitidos</label>
              <div className="row">
                {['Interno', 'Externo', 'Recibido', 'No radicable'].map((o) => (
                  <label key={o} className="switch"><input type="checkbox" defaultChecked /> {o}</label>
                ))}
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

export default Configuracion
