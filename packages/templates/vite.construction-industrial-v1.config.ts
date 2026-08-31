import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: './src/construction-industrial-v1',
  base: '/template-assets/construction-industrial-v1/',
  build: {
    outDir: '../../dist/construction-industrial-v1/public',
    emptyOutDir: true,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/construction-industrial-v1'),
    },
  },
  publicDir: false,
});
