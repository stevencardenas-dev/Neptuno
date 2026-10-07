import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Neptuno sigue una arquitectura de microservicios. El frontend solo habla con
// nginx (o con el dev server), que reparte cada ruta /api/<servicio>/* al
// microservicio correspondiente. Al sumar un servicio se agrega aquí su ruta.
const USUARIOS = process.env.USUARIOS_URL ?? 'http://localhost:8081'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/usuarios': { target: USUARIOS, changeOrigin: true },
    },
  },
})
