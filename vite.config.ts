import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(__dirname, 'frontend'),
  build: {
    outDir: resolve(__dirname, 'dist/frontend'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'frontend/index.html')
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'frontend/src'),
      '@shared': resolve(__dirname, 'frontend/src/shared')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Proxy Management API requests to backend
      '/v0/management': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      // Proxy normal API requests if needed
      '/v1': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      }
    }
  }
})
