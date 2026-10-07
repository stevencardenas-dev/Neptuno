import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de punta a punta del frontend contra el servicio de usuarios real.
 *
 * Playwright levanta los dos servidores si no están arriba:
 *  - servicio-usuarios con el perfil "test" (H2 en memoria: cada corrida parte de
 *    una base limpia con los datos iniciales de application-test.yml);
 *  - el dev server de Vite, cuyo proxy reenvía /api/usuarios al servicio.
 *
 * Usa puertos propios (servicio 8082, frontend 5174) para no chocar con los
 * servidores de desarrollo (8081 y 5173) si están encendidos.
 *
 * Usa el Chrome instalado en el equipo (channel: 'chrome'), así que no hace falta
 * descargar navegadores con `npx playwright install`.
 */
const PUERTO_SERVICIO = 8082
const PUERTO_FRONTEND = 5174

export default defineConfig({
  testDir: './e2e',
  // Las pruebas comparten la misma base en memoria: se ejecutan en orden.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PUERTO_FRONTEND}`,
    locale: 'es-CO',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], channel: 'chrome' }, testIgnore: /movil\.spec\.js/ },
    { name: 'movil', use: { ...devices['Pixel 7'], channel: 'chrome' }, testMatch: /movil\.spec\.js/ },
  ],
  webServer: [
    {
      command: 'mvn -q spring-boot:run -Dspring-boot.run.useTestClasspath=true',
      cwd: '../servicio-usuarios',
      env: {
        SPRING_PROFILES_ACTIVE: 'test',
        SPRING_CONFIG_ADDITIONAL_LOCATION: 'file:./src/test/resources/',
        SERVER_PORT: String(PUERTO_SERVICIO),
      },
      url: `http://localhost:${PUERTO_SERVICIO}/actuator/health`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run dev -- --port ${PUERTO_FRONTEND} --strictPort`,
      env: { USUARIOS_URL: `http://localhost:${PUERTO_SERVICIO}` },
      url: `http://localhost:${PUERTO_FRONTEND}`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
