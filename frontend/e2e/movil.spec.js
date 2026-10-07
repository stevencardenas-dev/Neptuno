import { expect, test } from '@playwright/test'
import { enlacesDelMenu, iniciarSesion } from './apoyo.js'

/** El contenido no debe desbordar el ancho de la pantalla (scroll horizontal de la página). */
async function sinDesbordeHorizontal(page) {
  const { ancho, contenido, culpables } = await page.evaluate(() => {
    const anchoVisible = document.documentElement.clientWidth
    const sobresale = (el) => el && el.getBoundingClientRect().right > anchoVisible + 1
    // Solo los elementos más externos que sobresalen, para señalar el origen del desborde.
    const externos = [...document.querySelectorAll('body *')]
      .filter((el) => sobresale(el) && !sobresale(el.parentElement))
      .map((el) => `<${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(el.getBoundingClientRect().width)}px`)
    return { ancho: anchoVisible, contenido: document.documentElement.scrollWidth, culpables: externos.slice(0, 5) }
  })
  expect(contenido, `la página mide ${contenido}px en una pantalla de ${ancho}px; sobresalen: ${culpables.join(', ')}`)
    .toBeLessThanOrEqual(ancho)
}

test.describe('Uso desde el celular', () => {
  test('login, panel y administración caben en la pantalla', async ({ page }) => {
    await page.goto('/login')
    await sinDesbordeHorizontal(page)

    await iniciarSesion(page)
    await expect(page.getByRole('heading', { name: /Buen día/ })).toBeVisible()
    await sinDesbordeHorizontal(page)

    for (const vista of ['Usuarios', 'Roles y permisos', 'Parámetros']) {
      await enlacesDelMenu(page).filter({ hasText: vista }).click()
      await page.waitForLoadState('networkidle')
      await sinDesbordeHorizontal(page)
    }
  })
})
