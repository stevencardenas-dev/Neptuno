import { expect } from '@playwright/test'

/**
 * Administrador sembrado por el perfil de pruebas del servicio
 * (servicio-usuarios/src/test/resources/application-test.yml).
 */
export const ADMIN = { correo: 'laura.restrepo@neptuno.gov.co', clave: 'Neptuno*2026', nombre: 'Laura' }

/** Clave de los usuarios que crean las pruebas (el servicio exige entre 10 y 72 caracteres). */
export const CLAVE_PRUEBA = 'Clave*Prueba2026'

// Mismo puerto que levanta playwright.config.js para el servicio.
const API = 'http://localhost:8082/api/usuarios'

export function correoUnico(prefijo = 'e2e') {
  return `${prefijo}.${Date.now()}.${Math.floor(Math.random() * 1000)}@neptuno.gov.co`
}

/** Inicia sesión desde la pantalla de login y espera el panel. */
export async function iniciarSesion(page, { correo, clave } = ADMIN) {
  await page.goto('/login')
  await page.getByLabel('Correo institucional').fill(correo)
  await page.getByLabel('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/app$/)
}

/** Token de acceso del administrador, para preparar datos directamente contra el API. */
export async function tokenAdmin(request) {
  const respuesta = await request.post(`${API}/auth/login`, { data: { correo: ADMIN.correo, clave: ADMIN.clave } })
  expect(respuesta.ok()).toBeTruthy()
  return (await respuesta.json()).acceso.token
}

async function idDe(request, token, ruta, campo, valor) {
  const respuesta = await request.get(`${API}${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
  const lista = await respuesta.json()
  const encontrado = lista.find((item) => item[campo] === valor)
  if (!encontrado) throw new Error(`No existe ${valor} en ${ruta}`)
  return encontrado.id
}

/** Crea un usuario con los roles indicados (por nombre) y devuelve su id y correo. */
export async function crearUsuario(request, token, nombresRoles) {
  const roles = []
  for (const nombre of nombresRoles) roles.push(await idDe(request, token, '/roles', 'nombre', nombre))
  const areaId = await idDe(request, token, '/areas', 'nombre', 'Subdirección Administrativa')
  const correo = correoUnico()
  const respuesta = await request.post(`${API}/usuarios`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { nombre: 'Usuario Prueba E2E', correo, clave: CLAVE_PRUEBA, areaId, estado: 'ACTIVO', roles },
  })
  expect(respuesta.status()).toBe(201)
  return { id: (await respuesta.json()).id, correo }
}

/** Cambia los roles de un usuario (HU-012). */
export async function asignarRoles(request, token, usuarioId, nombresRoles) {
  const roles = []
  for (const nombre of nombresRoles) roles.push(await idDe(request, token, '/roles', 'nombre', nombre))
  const respuesta = await request.put(`${API}/usuarios/${usuarioId}/roles`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { roles },
  })
  expect(respuesta.ok()).toBeTruthy()
}

/** Enlaces visibles del menú lateral. */
export function enlacesDelMenu(page) {
  return page.getByRole('complementary', { name: 'Navegación principal' }).getByRole('navigation').getByRole('link')
}
