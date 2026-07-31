import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/bankroll-pilot/',
  plugins: [react()],
  root: 'src/renderer',
  build: { outDir: '../../dist', emptyOutDir: true },
});
