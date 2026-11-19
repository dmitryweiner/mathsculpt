import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './src/sw-plugin.ts';

/** The package name is the app's id: the service worker's cache prefix (every app on the origin has its own). */
function appId(): string {
  const pkg: unknown = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'));
  if (typeof pkg === 'object' && pkg !== null && 'name' in pkg && typeof pkg.name === 'string') return pkg.name;
  throw new Error('package.json has no name');
}

export default defineConfig({
  base: './',
  // offline after a first visit: sw.js precaches the build and public/ (_conventions/pwa.md)
  plugins: [serviceWorkerPlugin({ appId: appId(), publicDir: resolve(import.meta.dirname, 'public') })],
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
