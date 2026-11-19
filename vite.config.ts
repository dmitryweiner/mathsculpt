import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // three is half a megabyte of the bundle: known, not news
    chunkSizeWarningLimit: 700,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
