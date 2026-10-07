import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as autenticacion from '../api/autenticacion.js'
import { guardarSesion, leerSesion, limpiarSesion } from '../api/almacenSesion.js'
import { EVENTO_SESION_PERDIDA, EVENTO_SESION_RENOVADA } from '../api/cliente.js'

/**
 * Sesión del usuario contra ms-auth-catalogs (HU-001, HU-002).
 *
 * Guarda el par de tokens y la sesión que entrega el servicio —nombre, área, rol
 * principal y permisos— para que el resto de la aplicación pueda decidir qué
 * mostrar sin volver a consultar el API (HU-013: permisos en cada funcionalidad).
 */
const ContextoSesion = createContext(null)

export function SesionProvider({ children }) {
  const [guardada, setGuardada] = useState(() => leerSesion())

  // Cuando el cliente no logra renovar un token (vencido o revocado) la sesión se
  // olvida y la guarda de rutas devuelve al login. Si la renueva, se recargan los
  // permisos para que el menú y las guardas reflejen los vigentes.
  useEffect(() => {
    const olvidar = () => setGuardada(null)
    const recargar = () => setGuardada(leerSesion())
    window.addEventListener(EVENTO_SESION_PERDIDA, olvidar)
    window.addEventListener(EVENTO_SESION_RENOVADA, recargar)
    return () => {
      window.removeEventListener(EVENTO_SESION_PERDIDA, olvidar)
      window.removeEventListener(EVENTO_SESION_RENOVADA, recargar)
    }
  }, [])

  const valor = useMemo(() => {
    const sesion = guardada?.sesion ?? null

    return {
      sesion,
      iniciar: async (correo, clave) => {
        const respuesta = await autenticacion.iniciarSesion(correo, clave)
        const nueva = { acceso: respuesta.acceso, refresco: respuesta.refresco, sesion: respuesta.sesion }
        guardarSesion(nueva)
        setGuardada(nueva)
        return respuesta.sesion
      },
      cerrar: async () => {
        try {
          // Se lee del almacenamiento porque el cliente pudo haber rotado el refresco.
          const refresco = leerSesion()?.refresco?.token
          if (refresco) await autenticacion.cerrarSesion(refresco)
        } catch {
          // Aunque el servicio no responda, la sesión local se cierra igual.
        } finally {
          limpiarSesion()
          setGuardada(null)
        }
      },
      puede: (permiso) => sesion?.permisos?.includes(permiso) ?? false,
    }
  }, [guardada])

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>
}

/** Acceso a la sesión vigente: `{sesion, iniciar, cerrar, puede}`. */
export function useSesion() {
  const contexto = useContext(ContextoSesion)
  if (!contexto) throw new Error('useSesion debe usarse dentro de SesionProvider')
  return contexto
}
