import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const apiPort = Number(process.env.PLATFORM_API_PORT || 3333);
const gatewayPort = Number(process.env.GATEWAY_PORT || 3000);

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PLATFORM_WEB_PORT || 3004),
    strictPort: true,
    hmr: {
      clientPort: gatewayPort
    },
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true
      }
    }
  }
})
