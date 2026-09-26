import { useState } from 'react'
import { Card, KV, Modal, Note, PageHead } from '../components/ui.jsx'
import { plantillaDetalle, plantillas } from '../data/mock.js'
import {
  IconArchivo, IconCheck, IconDescargar, IconEditar, IconInfo, IconMas,
  IconPlantillas, IconSubir, IconDestello, IconOjo,
} from '../components/Icons.jsx'

function Plantillas() {
  const [sel, setSel] = useState(plantillas[0])
  const [modal, setModal] = useState(false)

  return (
    <>
      <PageHead
        eyebrow="Gestión de plantillas y renderizado"
        title="Plantillas"
        sub="Sube plantillas, define sus variables dinámicas y genera el documento PDF final reemplazando etiquetas con los metadatos del radicado."
        hu={['HU-035', 'HU-036', 'HU-037', 'HU-038']}
        actions={[<button key="n" className="btn" type="button" onClick={() => setModal(true)}><IconSubir size={16} /> Subir plantilla</button>]}
      />

      <div className="grid grid-side">
        <div className="stack">
          <Card title="Catálogo de plantillas" icono={<IconPlantillas size={17} />} tight>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Plantilla</th><th>Orígenes</th><th>Variables</th><th>Usos</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
                <tbody>
                  {plantillas.map((p) => (
                    <tr key={p.id} onClick={() => setSel(p)} style={sel.id === p.id ? { background: 'rgba(47,107,255,0.1)' } : undefined}>
                      <td><strong>{p.nombre}</strong><span className="cell-sub">{p.archivo}</span></td>
                      <td><div className="row" style={{ gap: 6 }}>{p.origenes.map((o) => <span className="badge azul" key={o}>{o}</span>)}</div></td>
                      <td><span className="badge gris">{p.variables} etiquetas</span></td>
                      <td>{p.uso}</td>
                      <td><span className={`badge ${p.estado === 'Activa' ? 'verde' : p.estado === 'En borrador' ? 'ambar' : 'gris'}`}>{p.estado}</span></td>
                      <td><div className="td-actions">
                        <button className="btn ghost sm" type="button" title="Editar"><IconEditar size={15} /></button>
                        <button className="btn ghost sm" type="button" title="Descargar"><IconDescargar size={15} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title={`Variables de ${sel.nombre}`}
            sub="Etiquetas dinámicas que se reemplazan al renderizar"
            icono={<IconDestello size={17} />}
            actions={<button className="btn secondary sm" type="button"><IconMas size={15} /> Nueva variable</button>}
            tight
          >
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Etiqueta</th><th>Descripción</th><th>Ejemplo resuelto</th></tr></thead>
                <tbody>
                  {plantillaDetalle.variables.map((v) => (
                    <tr key={v.etiqueta}>
                      <td><span className="code">{v.etiqueta}</span></td>
                      <td className="muted">{v.descripcion}</td>
                      <td><strong>{v.ejemplo}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Vista previa" sub="Antes y después del renderizado" icono={<IconOjo size={17} />}>
            <div className="card pad" style={{ background: 'var(--superficie)' }}>
              <span className="muted small">Plantilla sin renderizar</span>
              <pre style={{ margin: '10px 0 0', fontSize: '0.72rem', color: 'var(--texto-tenue)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {plantillaDetalle.preview.join('\n')}
              </pre>
            </div>
            <div className="card pad mt-16" style={{ background: 'rgba(47,107,255,0.12)', borderColor: 'rgba(47,107,255,0.4)' }}>
              <span className="muted small">PDF renderizado</span>
              <pre style={{ margin: '10px 0 0', fontSize: '0.72rem', color: '#fff', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {'ORDEN DE COMPRA 20260925100008\n\nFecha: 2026-09-25\nÁrea solicitante: Compras y Proveedores\nProveedor: Suministros del Norte S.A.S. — NIT 900.123.456-1\n\nObjeto: Compra de papelería\nAdquisición de insumos de oficina para la sede administrativa.\n\nValor total: $ 42.500.000'}
              </pre>
            </div>
            <button className="btn block mt-16" type="button"><IconArchivo size={16} /> Convertir a PDF final</button>
            <button className="btn secondary block mt-8" type="button"><IconCheck size={16} /> Renderizar y radicar</button>
          </Card>

          <Card title="Propiedades" icono={<IconPlantillas size={17} />}>
            <KV items={[
              { k: 'Archivo', v: sel.archivo },
              { k: 'Orígenes vinculados', v: sel.origenes.join(', ') },
              { k: 'Variables', v: `${sel.variables}` },
              { k: 'Estado', v: sel.estado },
            ]} />
          </Card>

          <Note icono={<IconInfo size={17} />}>
            Una plantilla solo se ofrece en los orígenes <strong>Interno</strong> o <strong>Externo</strong>
            a los que esté vinculada, y el sistema reemplaza las variables con los metadatos ingresados.
          </Note>
        </div>
      </div>

      <Modal
        open={modal}
        title="Subir plantilla"
        sub="Carga el archivo y define sus etiquetas dinámicas"
        onClose={() => setModal(false)}
        footer={[
          <button key="c" className="btn secondary" type="button" onClick={() => setModal(false)}>Cancelar</button>,
          <button key="g" className="btn" type="button" onClick={() => setModal(false)}><IconCheck size={16} /> Guardar plantilla</button>,
        ]}
      >
        <label className="dropzone">
          <IconSubir size={22} />
          <strong>Arrastra la plantilla aquí (DOCX)</strong>
          <small>Formatos: DOCX · máx. 10 MB</small>
          <input type="file" hidden />
        </label>
        <div className="field">
          <label>Nombre de la plantilla <span className="req">*</span></label>
          <input type="text" placeholder="Ej. Orden de servicio" />
        </div>
        <div className="field">
          <label>Orígenes vinculados <span className="req">*</span></label>
          <div className="row">
            <label className="switch"><input type="checkbox" defaultChecked /> Interno</label>
            <label className="switch"><input type="checkbox" /> Externo</label>
          </div>
          <span className="hint">Solo Interno o Externo. No aplica a Recibido ni No radicable.</span>
        </div>
      </Modal>
    </>
  )
}

export default Plantillas
