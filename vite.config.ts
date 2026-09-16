import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** アプリのバージョン（package.json の version が唯一の正。0.x はベータ） */
function appVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }
  return pkg.version
}


/**
 * ビルド識別子（画面には出さない）。index.html の meta に埋めることで、
 * コードが同じでもコミットごとに Service Worker の precache が変わり、更新として検知される。
 * BUILD_ID 環境変数があればそれを優先（CI の更新フロー確認用）。
 */
function buildId(): string {
  if (process.env.BUILD_ID) return process.env.BUILD_ID
  const sha = process.env.GITHUB_SHA?.slice(0, 7)
  if (sha) return sha
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return String(Date.now())
  }
}

function buildIdMeta(): Plugin {
  return {
    name: 'build-id-meta',
    transformIndexHtml: (html) => html.replace('<meta name="theme-color"', `<meta name="build-id" content="${buildId()}" />
    <meta name="theme-color"`),
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [
    react(),
    buildIdMeta(),
    VitePWA({
      // 新バージョンは「更新」バナーで反映する（開いている画面が黙って古いままにならないように）
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'WorkOut',
        short_name: 'WorkOut',
        description: '自宅トレーニングと食事を最速で記録する',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#08080a',
        theme_color: '#08080a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 「更新」後に新しい SW が既存ページの制御を取り、再読み込みが走るようにする
        clientsClaim: true,
        skipWaiting: false,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
