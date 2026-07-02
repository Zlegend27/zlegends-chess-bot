import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

// Kindle/Fire-tablet build: served as a normal static site (Vercel), so the
// entry lives in its own kindle-web/index.html rather than sharing the
// project root with the main app's index.html. The legacy plugin is kept
// as a safety margin in case the device's browser is older than expected,
// even though a Fire tablet's Silk browser is far newer than a Kindle's.
export default defineConfig({
  root: 'kindle-web',
  plugins: [
    react(),
    legacy({
      targets: ['ie 11', 'safari 6', 'ios_saf 6', 'android 4'],
      renderLegacyChunks: true,
      polyfills: true,
    }),
  ],
  build: {
    outDir: '../dist-kindle',
    emptyOutDir: true,
  },
});
