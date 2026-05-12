import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: 'VoteMatch',
        short_name: 'VoteMatch',
        description: 'See how your representatives really vote. Compare their record to your values.',
        theme_color: '#f5f3ee',
        background_color: '#f5f3ee',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon.svg',     sizes: 'any',     type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/sitemap\.xml/],
        additionalManifestEntries: [],
        importScripts: ['/sw-push.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/votemap-production\.up\.railway\.app\/api\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxAgeSeconds: 300, maxEntries: 50 } },
          },
          {
            urlPattern: /^https:\/\/upload\.wikimedia\.org\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'wiki-photos', expiration: { maxAgeSeconds: 86400 * 30, maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  build: {
    commonjsOptions: { include: [/node_modules/] },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
