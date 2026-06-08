import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  // Serve o legado como estático para o iframe do Dashboard
  publicDir: 'public',
  server: {
    port: 3000,
    // Proxy legado em dev
  },
  build: {
    outDir:      'dist',
    sourcemap:   true,
    rollupOptions: {
      output: {
        // Code splitting por página
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'zustand':      ['zustand'],
          'lucide':       ['lucide-react'],
        },
      },
    },
  },
  test: {
    globals:     true,
    environment: 'jsdom',
    setupFiles:  ['./src/test/setup.ts'],
    coverage: {
      provider:   'v8',
      reporter:   ['text', 'json', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
