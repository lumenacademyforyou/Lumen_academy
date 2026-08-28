import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

// Phase F1 (LA-APP-COMPLETION-001) — frontend test tooling. Separate from
// vite.config.ts (not merged into it) because vitest's own config type
// doesn't strictly overlap with vite's — this only needs the same `@` alias
// and the react plugin so JSX/imports resolve the same way tests actually
// run in the app; it doesn't need vite.config's dev-server/build settings.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'frontend/src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, 'frontend/src/test/setup.ts')],
    include: ['frontend/src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
