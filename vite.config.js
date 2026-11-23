import { defineConfig } from 'vite';
// Preact with its React-compatible layer stands in for React in the main
// app: same components and hooks, about 40 KB less for every visitor to
// download. (The Kinnda build, vite.config.kindle.js, still uses React.)
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

// Service worker precaches the app shell so reopening from a home-screen
// install is instant (and works offline for anything except live bot
// moves, which need the network either way). manifest:false because
// public/manifest.json is already hand-authored and referenced directly
// from index.html -- this plugin only needs to add the service worker,
// not regenerate the manifest we already have.
//
// Tailwind is additive here, main app only (not vite.config.kindle.js --
// that build has its own separate CSS and no reason to carry the extra
// utility CSS). It coexists with the existing hand-written App.css/
// index.css rather than replacing them: see src/index.css for how
// preflight (Tailwind's base-style reset) is deliberately left out so it
// can't touch any element the existing styles already own. New UI (the
// nav rework, auth/login screens, etc.) can reach for Tailwind classes;
// nothing already working needs to be touched or converted.
export default defineConfig({
  /* The build's date and time, sent with crash reports and events so a
     problem can be tied to the version that had it. */
  define: { __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16)) },
  plugins: [
    preact(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      workbox: {
        // Only what every visit needs is downloaded up front: the page, the
        // app's code and styles, and the icons. What loads on demand (the
        // engine, the opening book, puzzles, Chess Tactica, pictures) is
        // cached the first time it's used instead (below). Precaching all of
        // it cost every first visit about 3.3 MB.
        globPatterns: ['index.html', 'assets/*.{js,css}', '*.{svg,png}'],
        globIgnores: ['**/TacticaPage-*.js', '**/engineWorker-*.js', '**/maiaWorker-*.js', '**/ecoOpenings-*.js', '**/puzzles-*.js', 'sweetheart-*.png'],
        // Stockfish's ~7MB wasm/js never changes without a version bump in
        // the file name here, so cache it long-term instead of re-fetching
        // every time a below-2000 difficulty tier is picked.
        runtimeCaching: [
          {
            /* Code loaded on demand: named by its content, so a cached copy
               is always right. */
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-chunks',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            /* Pictures: shown straight from the cache, refreshed behind. */
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(png|webp|jpg|svg|gif)$/.test(url.pathname) && !url.pathname.startsWith('/tactica/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'site-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            /* Maia's ~11MB model: same deal as Stockfish, so it isn't
               re-checked against the server on every visit. */
            urlPattern: /\/maia3\/.*\.onnx$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'maia-model',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
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
