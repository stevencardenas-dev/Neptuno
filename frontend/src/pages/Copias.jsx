import { useState } from 'react'
import { Card, Note, PageHead } from '../components/ui.jsx'
import { usePeticion } from '../api/usePeticion.js'
import { bandejaDeCopias, marcarCopiaLeida } from '../api/documentos.js'
import { formatearFechaHora } from '../util/formato.js'
import { IconInfo, IconOjo } from '../components/Icons.jsx'

/**
 * Bandeja secundaria de copias (HU-042).
 *
 * Quien recibe una copia la ve aquí sin que el documento cambie de manos ni entre en su
 * bandeja de tareas: una copia es informativa. Se marca como leída al abrirla, y el
 * filtro deja solo las pendientes.
 */

const ETIQUETA_ORIGEN = { INTERNO: 'Interno', EXTERNO: 'Externo', RECIBIDO: 'Recibido' }

export default function Copias() {
  const [soloNoLeidas, setSoloNoLeidas] = useState(false)
  const lista = usePeticion(
    () => bandejaDeCopias({ noLeidas: soloNoLeidas ? 'true' : undefined }),
    [soloNoLeidas],
  )
  const [error, setError] = useState(null)

  const copias = lista.datos ?? []
  const sinLeer = copias.filter((copia) => !copia.leidaEn).length

  async function abrir(copia) {
    if (copia.leidaEn) return
    setError(null)
    try {
      await marcarCopiaLeida(copia.id)
      lista.recargar()
    } catch (fallo) {
      setError(fallo)
    }
  }

  return (
    <>
      <PageHead
        title="Copias recibidas"
        sub="Radicados que otras personas compartieron contigo. Una copia es informativa: no entra en tu bandeja de tareas ni cambia el documento."
        actions={[
          <button key="r" className="btn secondary" type="button" disabled={lista.cargando} onClick={lista.recargar}>
            Actualizar
          </button>,
        ]}
      />

      <div className="toolbar">
        <label className="check">
          <input type="checkbox" checked={soloNoLeidas} onChange={(e) => setSoloNoLeidas(e.target.checked)} />
          <span>Solo las no leídas</span>
        </label>
        <span className="badge gris">{copias.length} {copias.length === 1 ? 'copia' : 'copias'}</span>
        {!soloNoLeidas && sinLeer ? <span className="badge ambar">{sinLeer} sin leer</span> : null}
      </div>

      {lista.error ? <div className="error-message mt-16">{lista.error}</div> : null}
      {error ? <div className="error-message mt-16">{error.message}</div> : null}

      <Card className="mt-16" tight>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Radicado</th>
                <th>Mensaje</th>
                <th>Recibida</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {copias.map((copia) => (
                <tr key={copia.id} className={copia.leidaEn ? '' : 'fila-nueva'}>
                  <td>
                    <span className="code">{copia.radicado.codigo}</span>
                    <span className="cell-sub">{copia.radicado.asunto}</span>
                  </td>
                  <td>
                    {copia.mensaje ? <span>{copia.mensaje}</span> : <span className="muted">Sin mensaje</span>}
                    <span className="cell-sub">
                      Origen {ETIQUETA_ORIGEN[copia.radicado.origen] ?? copia.radicado.origen} · {copia.radicado.estado}
                    </span>
                  </td>
                  <td className="muted">{formatearFechaHora(copia.enviadaEn)}</td>
                  <td>
                    <div className="td-actions">
                      {copia.leidaEn ? (
                        <span className="badge gris">Leída</span>
                      ) : (
                        <button className="btn ghost sm" type="button" onClick={() => abrir(copia)}>
                          <IconOjo size={15} /> Marcar leída
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!copias.length ? (
            <div className="empty">
              {lista.cargando
                ? 'Cargando las copias…'
                : soloNoLeidas
                  ? 'No tienes copias sin leer.'
                  : 'Todavía no has recibido copias de ningún radicado.'}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="mt-16">
        <Note icono={<IconInfo size={17} />}>
          Para compartir un radicado, abre su detalle en Radicados y usa «Enviar copia». El
          destinatario debe ser un usuario activo del sistema.
        </Note>
      </div>
    </>
  )
}
