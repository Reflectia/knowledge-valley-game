/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Relative base so the static build works on GitHub Pages under any repo path.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ds': fileURLToPath(new URL('./design-system', import.meta.url)),
    },
  },
  build: {
    // Phaser alone is ~1.2 MB minified; keep the warning meaningful for our own code.
    chunkSizeWarningLimit: 2000,
    // Never inline pixel art as data URLs with lossy tricks; keep files as-is.
    assetsInlineLimit: 0,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
