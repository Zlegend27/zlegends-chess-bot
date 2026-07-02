import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

// Separate build for the jailbroken-Kindle target: old WebKit "Experimental
// Browser", so this transpiles/polyfills much further down than the main
// web build and produces its own isolated output directory.
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['ie 11', 'safari 6', 'ios_saf 6', 'android 4'],
      renderLegacyChunks: true,
      polyfills: true,
    }),
  ],
  build: {
    outDir: 'dist-kindle',
    rollupOptions: {
      input: 'kindle.html',
    },
  },
});
