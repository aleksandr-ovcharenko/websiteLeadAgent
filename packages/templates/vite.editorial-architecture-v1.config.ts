import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: './src/editorial-architecture-v1',
  base: '/template-assets/editorial-architecture-v1/',
  build: {
    outDir: '../../dist/editorial-architecture-v1/public',
    emptyOutDir: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/editorial-architecture-v1'),
    },
  },
  publicDir: false,
});
