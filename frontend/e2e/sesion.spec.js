import { expect, test } from '@playwright/test'
import { ADMIN, enlacesDelMenu, iniciarSesion } from './apoyo.js'

test.describe('Autenticación (HU-001, HU-002)', () => {
  test('la raíz lleva al login y no quedan restos del demo de mockups', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()

    // Sin correo precargado, sin credenciales a la vista y sin enlace al índice de mockups.
    await expect(page.getByLabel('Correo institucional')).toHaveValue('')
    await expect(page.getByText(/mockup/i)).toHaveCount(0)
    await expect(page.getByText(ADMIN.clave)).toHaveCount(0)
    await expect(page.getByText('¿Olvidaste tu contraseña?')).toHaveCount(0)
  })

  test('las credenciales inválidas muestran el mensaje del servicio', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Correo institucional').fill(ADMIN.correo)
    await page.getByLabel('Contraseña').fill('clave-equivocada')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByText('El correo o la contraseña no son correctos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('el administrador entra al panel con sus datos reales', async ({ page }) => {
    await iniciarSesion(page)

    await expect(page.getByRole('heading', { name: `Buen día, ${ADMIN.nombre}` })).toBeVisible()
    await expect(page.getByText('Subdirección Administrativa · Rol Administrador.')).toBeVisible()
    // Métricas reales del API: los 6 roles sembrados (ninguna prueba crea roles) y un
    // conteo de áreas, que otras pruebas pueden aumentar.
    await expect(page.getByRole('link', { name: /6\s*Roles definidos/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /\d+\s*Áreas activas/ })).toBeVisible()

    await expect(enlacesDelMenu(page)).toHaveText(['Panel', 'Usuarios', 'Roles y permisos', 'Parámetros'])

    // Las 5 métricas van en una sola fila en escritorio y no se ven como texto subrayado.
    const metricas = page.locator('a.stat-enlace')
    await expect(metricas).toHaveCount(5)
    const filas = new Set(await metricas.evaluateAll((enlaces) => enlaces.map((e) => Math.round(e.getBoundingClientRect().top))))
    expect(filas.size).toBe(1)
    await expect(metricas.first()).toHaveCSS('text-decoration-line', 'none')
  })

  test('las rutas de las vistas eliminadas vuelven al panel', async ({ page }) => {
    await iniciarSesion(page)
    for (const ruta of ['/app/bandeja', '/app/radicacion', '/app/flujos', '/no-existe']) {
      await page.goto(ruta)
      await expect(page).toHaveURL(/\/app$/)
    }
  })

  test('cerrar sesión vuelve al login y protege las páginas privadas', async ({ page }) => {
    await iniciarSesion(page)
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/app/usuarios')
    await expect(page).toHaveURL(/\/login$/)
  })
})
