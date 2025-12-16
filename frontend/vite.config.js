import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    },
    allowedHosts: ['localhost', '127.0.0.1', "logradar.denovo-share.com", "logradarapi.denovo-share.com"],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
