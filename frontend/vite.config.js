import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Neptuno sigue una arquitectura de microservicios. El frontend solo habla con
// nginx (o con el dev server), que reparte cada ruta /api/* al servicio
// correspondiente. De momento el frontend funciona con datos mock, pero la
// proxy queda lista para cuando los servicios estén levantados.
const USUARIOS = 'http://localhost:8081'
const PAGOS = 'http://localhost:8082'
const INVENTARIO = 'http://localhost:8083'
const NOTIFICACIONES = 'http://localhost:8084'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/usuarios': { target: USUARIOS, changeOrigin: true },
      '/api/pagos': { target: PAGOS, changeOrigin: true },
      '/api/inventario': { target: INVENTARIO, changeOrigin: true },
      '/api/notificaciones': { target: NOTIFICACIONES, changeOrigin: true },
    },
  },
})
