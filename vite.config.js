import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import thirdPartyNotices from './scripts/third-party-notices.js';

export default defineConfig({
  define: {
    // Shown in the sidebar footer, so you can tell which build (deployed or cached) you're looking at.
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'ArchNorth',
        short_name: 'ArchNorth',
        description: 'Interactive learning hub for system design, Java, microservices, and software architecture',
        theme_color: '#1a1b1e',
        background_color: '#1a1b1e',
        display: 'standalone',
        scope: '/ArchNorth/',
        start_url: '/ArchNorth/',
        icons: [
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        runtimeCaching: [
          {
            // SQL Playground engine (~650 KB): cached on first use instead of precached for everyone
            urlPattern: /\.wasm$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: { maxEntries: 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Bundled fonts: browsers fetch only the character subsets a page uses, then reuse them
            urlPattern: /\.woff2$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Plain files such as third-party-licenses.txt must open as files, not as the app's index.html
        navigateFallbackDenylist: [/\.txt$/i],
      },
    }),
    thirdPartyNotices(),
  ],
  base: '/ArchNorth/',
  assetsInclude: ['**/*.md'],
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw'],
          'vendor-mermaid': ['mermaid'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
