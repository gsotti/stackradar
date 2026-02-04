import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_VERSION__: JSON.stringify(process.env.BUILD_VERSION || 'dev'),
    __BUILD_COMMIT__: JSON.stringify(process.env.BUILD_COMMIT || 'local'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
