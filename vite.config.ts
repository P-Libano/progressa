import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Regex (não funções): o workbox copia o padrão para dentro do sw.js, onde constantes deste arquivo não existem.
const DATASET_JSON = /^https:\/\/cdn\.jsdelivr\.net\/gh\/hasaneyldrm\/exercises-dataset@[^/]+\/data\/exercises\.json$/
const DATASET_MEDIA = /^https:\/\/cdn\.jsdelivr\.net\/gh\/hasaneyldrm\/exercises-dataset@[^/]+\/(images|videos)\//

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages publica em https://<usuário>.github.io/progressa/; em dev fica na raiz (preview usa a do build)
  base: command === 'build' || isPreview ? (process.env.BASE_PATH ?? '/progressa/') : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // o app pergunta antes de trocar de versão (não interrompe um treino)
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Progressa — treino de musculação',
        short_name: 'Progressa',
        description: 'Treino de musculação com progressão automática, histórico e rotinas por objetivo.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // base de exercícios (~1,5 MB comprimido); o app também guarda a versão enxuta no IndexedDB
            urlPattern: DATASET_JSON,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'progressa-dataset', expiration: { maxEntries: 2 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // GIFs e miniaturas: guardados conforme o usuário vê cada exercício (nunca em lote: o CDN limita taxa)
            urlPattern: DATASET_MEDIA,
            handler: 'CacheFirst',
            options: {
              cacheName: 'progressa-midia',
              expiration: { maxEntries: 800, maxAgeSeconds: 90 * 24 * 60 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
}))
