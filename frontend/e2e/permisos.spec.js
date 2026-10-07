import { expect, test } from '@playwright/test'
import {
  CLAVE_PRUEBA, asignarRoles, crearUsuario, enlacesDelMenu, iniciarSesion, tokenAdmin,
} from './apoyo.js'

test.describe('Permisos y sesión (HU-013)', () => {
  test('un usuario sin permisos administrativos no ve ni abre esas vistas', async ({ page, request }) => {
    const admin = await tokenAdmin(request)
    const auditor = await crearUsuario(request, admin, ['Auditor'])

    await iniciarSesion(page, { correo: auditor.correo, clave: CLAVE_PRUEBA })
    await expect(enlacesDelMenu(page)).toHaveText(['Panel'])
    await expect(page.getByText('Tu rol todavía no tiene permisos')).toBeVisible()

    // Escribir la URL a mano tampoco muestra la vista.
    await page.goto('/app/usuarios')
    await expect(page).toHaveURL(/\/app$/)
  })

  test('renueva un token de acceso vencido sin sacar al usuario', async ({ page }) => {
    await iniciarSesion(page)

    // Simula un token vencido: el cliente debe renovarlo con el refresco y repetir la petición.
    const refrescoAntes = await page.evaluate(() => {
      const sesion = JSON.parse(localStorage.getItem('neptuno.sesion'))
      sesion.acceso.token = 'token-vencido'
      localStorage.setItem('neptuno.sesion', JSON.stringify(sesion))
      return sesion.refresco.token
    })

    await enlacesDelMenu(page).filter({ hasText: 'Roles y permisos' }).click()
    await expect(page).toHaveURL(/\/app\/roles$/)
    await expect(page.getByRole('button', { name: /^A\s*Administrador/ })).toBeVisible()

    const sesion = await page.evaluate(() => JSON.parse(localStorage.getItem('neptuno.sesion')))
    expect(sesion.acceso.token).not.toBe('token-vencido')
    expect(sesion.refresco.token).not.toBe(refrescoAntes)
  })

  test('al cambiar los roles de un usuario conectado, su menú se actualiza', async ({ page, request }) => {
    const admin = await tokenAdmin(request)
    const usuario = await crearUsuario(request, admin, ['Radicador'])

    await iniciarSesion(page, { correo: usuario.correo, clave: CLAVE_PRUEBA })
    await expect(enlacesDelMenu(page)).toHaveText(['Panel', 'Parámetros'])

    // El iat del JWT tiene precisión de segundos: el cambio debe ser posterior al login.
    await page.waitForTimeout(1100)
    await asignarRoles(request, admin, usuario.id, ['Auditor'])

    // La siguiente petición recibe 401, el cliente renueva y recarga la sesión.
    await page.reload()
    await expect(enlacesDelMenu(page)).toHaveText(['Panel'])
    await expect(page).toHaveURL(/\/app$/)
  })
})
