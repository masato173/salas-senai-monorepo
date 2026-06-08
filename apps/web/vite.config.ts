import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      input: resolve(__dirname, '../../apps/legacy/index.html'),
    },
  },
  test: {
    globals:     true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines:      80,
        functions:  80,
        branches:   70,
        statements: 80,
      },
    },
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
