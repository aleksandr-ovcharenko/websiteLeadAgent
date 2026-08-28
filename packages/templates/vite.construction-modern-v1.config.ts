import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: './src/construction-modern-v1',
  base: '/template-assets/construction-modern-v1/',
  build: {
    outDir: '../../dist/construction-modern-v1/public',
    emptyOutDir: true,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/construction-modern-v1'),
    },
  },
  publicDir: false,
});
