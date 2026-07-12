import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Dev-only shim: inject the React Fast Refresh preamble into index.html.
// @vitejs/plugin-react@6 + vite@8 leave the global `$RefreshSig$`/`$RefreshReg$`
// undefined in classic (non-bundled) dev — refresh-wrapped modules reference
// `$RefreshSig$()` but the preamble that defines it is never loaded, crashing the
// app with "ReferenceError: $RefreshSig$ is not defined". This replicates the
// standard preamble plugin-react would otherwise inject. `apply: 'serve'` keeps it
// out of production builds.
function reactRefreshPreamble() {
  return {
    name: 'react-refresh-preamble-shim',
    apply: 'serve' as const,
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          injectTo: 'head-prepend' as const,
          children: [
            'import RefreshRuntime from "/@react-refresh"',
            'RefreshRuntime.injectIntoGlobalHook(window)',
            'window.$RefreshReg$ = () => {}',
            'window.$RefreshSig$ = () => (type) => type',
            'window.__vite_plugin_react_preamble_installed__ = true',
          ].join('\n'),
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    reactRefreshPreamble(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'FNOL Claims',
        short_name: 'FNOL',
        description: 'First Notice of Loss — conversational claims intake',
        theme_color: '#161616',
        background_color: '#161616',
        display: 'standalone',
        start_url: '/claims/intake',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Precache app shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Network-first for FNOL session reads (support resume)
            urlPattern: /\/api\/v1\/fnol\/sessions\/.+$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fnol-sessions',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Background sync for mutating FNOL calls
            urlPattern: /\/api\/v1\/fnol\/.+(\/turns|\/consent|\/evidence|\/submit)$/,
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'fnol-write-queue',
                options: { maxRetentionTime: 60 * 24 * 7 }, // 7 days
              },
            },
          },
          {
            // Cache-first for static assets
            urlPattern: /\.(js|css|woff2|png|svg|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
