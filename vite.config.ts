import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // three is half a megabyte of the bundle: known, not news
    chunkSizeWarningLimit: 700,
  },
  // the build worker is an ES module, as the kit's worker client expects
  worker: { format: 'es' },
  // maker-kit is TypeScript sources: the dev server's pre-bundling would read
  // them as JavaScript and die; excluded, vite serves them as the app's own
  optimizeDeps: { exclude: ['maker-kit'] },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // node does not strip the types of files in node_modules: vitest transforms the kit as the app's own
    server: { deps: { inline: ['maker-kit'] } },
  },
});
