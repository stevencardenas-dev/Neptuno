import { useState } from 'react'
import { Card, Note, PageHead } from '../components/ui.jsx'
import { areas, entidades, tiposDocumentales } from '../data/mock.js'
import {
  IconArchivo, IconCheck, IconEditar, IconFirma, IconGuardar, IconInfo,
  IconMas, IconPapelera, IconSubir, IconUsuarios,
} from '../components/Icons.jsx'

const origenes = [
  { id: 'Interno', digito: '1', desc: 'Documento generado dentro de la organización.' },
  { id: 'Externo', digito: '2', desc: 'Documento dirigido a una entidad externa.' },
  { id: 'Recibido', digito: '3', desc: 'Correspondencia externa recibida. Solo rol Radicador.' },
  { id: 'No radicable', digito: '4', desc: 'Soporte archivado sin trámite de flujo.' },
]

const anexosIniciales = [
  { nombre: 'factura_FE-88214.pdf', ext: 'pdf', peso: '1.2 MB' },
  { nombre: 'orden_compra_OC-0148.pdf', ext: 'pdf', peso: '640 KB' },
  { nombre: 'cuadro_comparativo.xlsx', ext: 'xls', peso: '208 KB' },
]

const destinatarios = ['Claudia Vega', 'Andrés Molina', 'Diego Ramírez', 'Mateo Arias', 'Paola Suárez']

function Radicacion() {
  const [origen, setOrigen] = useState('Recibido')
  const [clase, setClase] = useState('Original')
  const [anexos, setAnexos] = useState(anexosIniciales)
  const [dest, setDest] = useState(['Claudia Vega'])

  const codigoPreview = `20260925${origenes.find((o) => o.id === origen).digito}0057`

  return (
    <>
      <PageHead
        eyebrow="Radicación de documentos"
        title="Registrar radicado"
        sub="El código de radicado es único e inmutable y se asigna automáticamente con el formato AAAAMMDD + X + CONSECUTIVO."
        hu={['HU-017', 'HU-018', 'HU-019', 'HU-021', 'HU-024', 'HU-025', 'HU-026', 'HU-027', 'HU-029', 'HU-034', 'HU-039', 'HU-040', 'HU-041']}
        actions={[
          <button key="g" className="btn secondary" type="button"><IconGuardar size={16} /> Guardar borrador</button>,
          <button key="r" className="btn" type="button"><IconCheck size={16} /> Radicar documento</button>,
        ]}
      />

      <div className="stepper">
        <span className="step done"><span className="num">1</span> Origen</span>
        <span className="step done"><span className="num">2</span> Metadatos</span>
        <span className="step active"><span className="num">3</span> Metadatos extendidos</span>
        <span className="step"><span className="num">4</span> Anexos y clase</span>
        <span className="step"><span className="num">5</span> Destinatarios</span>
      </div>

      <div className="stack mt-16">
        <div className="stack">
          <Card title="Origen del documento" sub="Habilita los campos según el tipo de radicación" icono={<IconArchivo size={17} />}>
            <div className="choice-grid">
              {origenes.map((o) => (
                <button key={o.id} type="button" className={`choice ${origen === o.id ? 'active' : ''}`} onClick={() => setOrigen(o.id)}>
                  <div className="choice-top">
                    <strong>{o.id}</strong>
                    <span className="digit">{o.digito}</span>
                  </div>
                  <small>{o.desc}</small>
                </button>
              ))}
            </div>
            {origen === 'Recibido' ? (
              <Note icono={<IconInfo size={17} />}>
                Solo los usuarios con rol <strong>Radicador</strong> pueden registrar documentos de origen Recibido.
              </Note>
            ) : null}
          </Card>

          <Card title="Metadatos obligatorios" sub="No se puede guardar con campos vacíos" icono={<IconEditar size={17} />}>
            <div className="field-row">
              <div className="field">
                <label>Título del documento <span className="req">*</span></label>
                <input type="text" defaultValue="Solicitud de compra de equipos de cómputo" />
              </div>
              <div className="field">
                <label>Fecha <span className="req">*</span></label>
                <input type="date" defaultValue="2026-09-25" />
              </div>
            </div>
            <div className="field mt-16">
              <label>Resumen <span className="req">*</span></label>
              <textarea defaultValue="Factura remitida por Suministros del Norte S.A.S. por la adquisición de 25 equipos de cómputo para la sede administrativa, según orden de compra OC-2026-0148." />
            </div>
            <div className="field-row mt-16">
              <div className="field">
                <label>Tipo documental <span className="req">*</span></label>
                <select defaultValue="Factura">
                  {tiposDocumentales.filter((t) => t.origenes.includes(origen) || origen === 'Recibido').map((t) => <option key={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Área encargada <span className="req">*</span></label>
                <select defaultValue="Compras y Proveedores">
                  {areas.map((a) => <option key={a.id}>{a.nombre}</option>)}
                </select>
              </div>
            </div>
          </Card>

          <Card title="Metadatos extendidos" sub="Complementan la información base según el trámite" icono={<IconInfo size={17} />}>
            <div className="field-row">
              <div className="field">
                <label>NIT</label>
                <select defaultValue="900.123.456-1">
                  {entidades.map((e) => <option key={e.nit}>{e.nit}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Entidad</label>
                <select defaultValue="Suministros del Norte S.A.S.">
                  {entidades.map((e) => <option key={e.nit}>{e.razonSocial}</option>)}
                </select>
              </div>
            </div>
            <div className="field-row mt-16">
              <div className="field">
                <label>Área</label>
                <select defaultValue="Compras y Proveedores">{areas.map((a) => <option key={a.id}>{a.nombre}</option>)}</select>
              </div>
              <div className="field">
                <label>Nombre de carpeta</label>
                <input type="text" defaultValue="Facturas / 2026 / Septiembre" />
              </div>
            </div>
            <div className="field mt-16">
              <label>Comentarios</label>
              <textarea defaultValue="Verificar descuento por pronto pago del 3%." />
            </div>
          </Card>

          <Card title="Anexos" sub="PDF, PNG, JPG, DOCX y XLSX · varios archivos a la vez" icono={<IconSubir size={17} />}>
            <label className="dropzone">
              <IconSubir size={22} />
              <strong>Arrastra los archivos aquí o haz clic para seleccionar</strong>
              <small>Formatos permitidos: PDF, PNG, JPG, DOCX, XLSX · máx. 20 MB por archivo</small>
              <input type="file" multiple hidden />
            </label>
            <div className="stack mt-16" style={{ gap: 10 }}>
              {anexos.map((a, i) => (
                <div className="chip-file" key={a.nombre}>
                  <span className={`ext ${a.ext}`}>{a.ext.toUpperCase()}</span>
                  <div className="meta">
                    <strong>{a.nombre}</strong>
                    <small>{a.peso} · cargado por Paola Suárez</small>
                  </div>
                  <button className="btn ghost sm" type="button" title="Eliminar anexo" onClick={() => setAnexos(anexos.filter((_, j) => j !== i))}>
                    <IconPapelera size={15} />
                  </button>
                </div>
              ))}
              {!anexos.length ? <div className="empty">Sin anexos. Adjunta al menos un soporte.</div> : null}
            </div>
            <p className="hint mt-16">Eliminar un anexo deja constancia en la bitácora de auditoría.</p>
          </Card>

          <Card title="Clase del documento" sub="Diferencia la pieza principal de sus duplicados" icono={<IconFirma size={17} />}>
            <div className="row">
              <button type="button" className={`choice ${clase === 'Original' ? 'active' : ''}`} style={{ maxWidth: 260 }} onClick={() => setClase('Original')}>
                <strong>Original</strong><small>Pieza principal del trámite.</small>
              </button>
              <button type="button" className={`choice ${clase === 'Copia' ? 'active' : ''}`} style={{ maxWidth: 260 }} onClick={() => setClase('Copia')}>
                <strong>Copia</strong><small>Duplicado informativo que no altera el trámite.</small>
              </button>
            </div>
          </Card>

          <Card title="Destinatarios de copia" sub="Recibirán un duplicado sin alterar el trámite original" icono={<IconUsuarios size={17} />}>
            <div className="row">
              {destinatarios.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`badge ${dest.includes(d) ? 'azul' : 'gris'}`}
                  style={{ cursor: 'pointer', padding: '7px 13px' }}
                  onClick={() => setDest(dest.includes(d) ? dest.filter((x) => x !== d) : [...dest, d])}
                >
                  {dest.includes(d) ? <IconCheck size={13} /> : <IconMas size={13} />} {d}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-3">
          <Card title="Vista previa del radicado" icono={<IconInfo size={17} />}>
            <div className="card pad" style={{ background: 'var(--superficie)', textAlign: 'center' }}>
              <span className="muted small">Código asignado automáticamente</span>
              <div className="code" style={{ fontSize: '1.15rem', marginTop: 10, display: 'inline-block', padding: '8px 16px' }}>{codigoPreview}</div>
              <div className="row mt-16" style={{ justifyContent: 'center', gap: 8 }}>
                <span className="badge azul">{origen} · {origenes.find((o) => o.id === origen).digito}</span>
                <span className={`badge ${clase === 'Original' ? 'verde' : 'ambar'}`}>{clase}</span>
              </div>
            </div>
            <ul className="kv mt-16">
              <li className="k" style={{ listStyle: 'none' }}>Formato: <strong className="strong">AAAAMMDD + X + CONSECUTIVO</strong></li>
              <li className="k" style={{ listStyle: 'none' }}>1 = Interno · 2 = Externo · 3 = Recibido · 4 = No radicable</li>
            </ul>
          </Card>

          <Card title="Requisitos por origen" icono={<IconInfo size={17} />}>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row between"><span className="muted">NIT y entidad</span><span className={`badge ${['Recibido', 'Externo'].includes(origen) ? 'verde' : 'gris'}`}>{['Recibido', 'Externo'].includes(origen) ? 'Requerido' : 'Opcional'}</span></div>
              <div className="row between"><span className="muted">Tipo documental</span><span className="badge verde">Requerido</span></div>
              <div className="row between"><span className="muted">Flujo de aprobación</span><span className={`badge ${origen === 'No radicable' ? 'gris' : 'verde'}`}>{origen === 'No radicable' ? 'No aplica' : 'Requerido'}</span></div>
              <div className="row between"><span className="muted">Carpeta del expediente</span><span className={`badge ${origen === 'No radicable' ? 'verde' : 'gris'}`}>{origen === 'No radicable' ? 'Requerido' : 'Automática'}</span></div>
            </div>
          </Card>

          {origen === 'No radicable' ? (
            <Note icono={<IconInfo size={17} />}>
              Los documentos <strong>No radicables</strong> se archivan directamente en una subcarpeta
              del expediente con su consecutivo, sin iniciar flujo.
            </Note>
          ) : null}
        </div>
      </div>
    </>
  )
}

export default Radicacion
