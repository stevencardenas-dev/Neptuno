import { useEffect, useRef, useState } from 'react'

/**
 * Ejecuta una llamada al API y expone su estado a la vista.
 *
 * La consulta se repite cuando cambian las dependencias y también con
 * `recargar()`, que es lo que se usa después de crear, editar o dar de baja.
 *
 * @param {Function} consulta      función sin argumentos que devuelve la promesa
 * @param {Array} dependencias     valores de los que depende la consulta
 * @returns {{datos: any, cargando: boolean, error: string, recargar: Function}}
 */
export function usePeticion(consulta, dependencias = []) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  // La consulta se guarda en un ref para que la petición no se dispare en cada
  // render: solo cuando cambian las dependencias reales o se pide recargar.
  const consultaRef = useRef(consulta)
  consultaRef.current = consulta

  useEffect(() => {
    let vigente = true
    setCargando(true)
    consultaRef.current()
      .then((resultado) => {
        if (!vigente) return
        setDatos(resultado)
        setError('')
      })
      .catch((fallo) => {
        if (vigente) setError(fallo.message)
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, version])

  return { datos, cargando, error, recargar: () => setVersion((v) => v + 1) }
}
