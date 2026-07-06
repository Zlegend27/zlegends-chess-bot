import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Service worker precaches the app shell so reopening from a home-screen
// install is instant (and works offline for anything except live bot
// moves, which need the network either way). manifest:false because
// public/manifest.json is already hand-authored and referenced directly
// from index.html -- this plugin only needs to add the service worker,
// not regenerate the manifest we already have.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og.jpg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp}'],
        // Stockfish's ~7MB wasm/js never changes without a version bump in
        // the file name here, so cache it long-term instead of re-fetching
        // every time a below-2000 difficulty tier is picked.
        runtimeCaching: [
          {
            urlPattern: /\/stockfish\/.*\.(js|wasm)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'stockfish-engine',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
