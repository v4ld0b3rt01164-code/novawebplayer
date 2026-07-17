import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      // Em dev, o frontend fala apenas com o próprio backend (mesma origem em prod)
      '/api': 'http://localhost:3001',
      '/stream': 'http://localhost:3001',
    },
  },
})
