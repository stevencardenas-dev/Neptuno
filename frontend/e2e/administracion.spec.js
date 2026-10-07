import { expect, test } from '@playwright/test'
import { CLAVE_PRUEBA, correoUnico, enlacesDelMenu, iniciarSesion } from './apoyo.js'

test.describe('Administración', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page)
  })

  test('crea un usuario desde el formulario y aparece en el listado (HU-003, HU-006)', async ({ page }) => {
    const correo = correoUnico('ui')
    await enlacesDelMenu(page).filter({ hasText: 'Usuarios' }).click()
    await page.getByRole('button', { name: 'Nuevo usuario' }).click()

    const dialogo = page.getByRole('dialog', { name: 'Nuevo usuario' })
    await dialogo.getByLabel('Nombre completo').fill('Camila Prueba Interfaz')
    await dialogo.getByLabel('Correo institucional').fill(correo)
    await dialogo.getByLabel('Área').selectOption({ label: 'Contabilidad y Tesorería' })
    await dialogo.getByLabel('Contraseña inicial').fill(CLAVE_PRUEBA)
    await dialogo.getByRole('group', { name: 'Roles asignados' }).getByRole('checkbox', { name: /Tesorero/ }).check()
    await dialogo.getByRole('button', { name: 'Guardar usuario' }).click()
    await expect(dialogo).toBeHidden()

    await page.getByPlaceholder('Buscar por nombre o correo…').fill(correo)
    const fila = page.getByRole('row', { name: new RegExp(correo.replace(/\./g, '\\.')) })
    await expect(fila).toBeVisible()
    await expect(fila).toContainText('Contabilidad y Tesorería')
    await expect(fila).toContainText('Tesorero')
  })

  test('el formulario de usuario muestra los errores de validación del servicio', async ({ page }) => {
    await enlacesDelMenu(page).filter({ hasText: 'Usuarios' }).click()
    await page.getByRole('button', { name: 'Nuevo usuario' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nuevo usuario' })
    await dialogo.getByRole('button', { name: 'Guardar usuario' }).click()

    await expect(dialogo.locator('.error-message')).toBeVisible()
    // Escape cierra el diálogo sin guardar.
    await page.keyboard.press('Escape')
    await expect(dialogo).toBeHidden()
  })

  test('crea un área en los parámetros del sistema (HU-016)', async ({ page }) => {
    const nombre = `Área E2E ${Date.now()}`
    await enlacesDelMenu(page).filter({ hasText: 'Parámetros' }).click()
    await page.getByRole('button', { name: 'Áreas', exact: true }).click()
    await page.getByRole('button', { name: 'Agregar' }).click()

    const dialogo = page.getByRole('dialog', { name: 'Nueva área' })
    await dialogo.getByLabel('Código').fill(`E${String(Date.now()).slice(-5)}`)
    await dialogo.getByLabel('Nombre del área').fill(nombre)
    await dialogo.getByLabel('Responsable').fill('Responsable E2E')
    await dialogo.getByRole('button', { name: /Guardar/ }).click()
    await expect(dialogo).toBeHidden()

    await expect(page.getByRole('row', { name: new RegExp(nombre) })).toBeVisible()
  })

  test('los roles se seleccionan con el teclado (HU-010)', async ({ page }) => {
    await enlacesDelMenu(page).filter({ hasText: 'Roles y permisos' }).click()
    const auditor = page.getByRole('button', { name: /^A\s*Auditor/ })
    await auditor.focus()
    await page.keyboard.press('Enter')

    await expect(auditor).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Permisos del rol Auditor')).toBeVisible()
  })
})
