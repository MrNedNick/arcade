/// <reference types="vitest/config" />
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { GAME_IDS } from './src/games/ids.ts'

/**
 * GitHub Pages has no SPA rewrites. Every game gets its own copy of index.html
 * so a direct link like /arcade/snake/ answers 200, and 404.html catches the rest.
 */
function pagesFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'pages-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const index = resolve(outDir, 'index.html')
      for (const id of GAME_IDS) {
        mkdirSync(resolve(outDir, id), { recursive: true })
        copyFileSync(index, resolve(outDir, id, 'index.html'))
      }
      copyFileSync(index, resolve(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  base: '/arcade/',
  plugins: [
    vue(),
    pagesFallback(),
    VitePWA({
      // A new version activates as soon as it is downloaded and the page reloads once;
      // an unfinished game is saved on the way out and offered back after the reload.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Arcade — free browser games',
        short_name: 'Arcade',
        description:
          'Snake, Tetris, Minesweeper, Sudoku and Memory. No ads, no sign-up, works offline.',
        lang: 'en',
        start_url: '/arcade/',
        scope: '/arcade/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0d17',
        theme_color: '#0b0d17',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: GAME_IDS.map((id) => ({
          name: id[0]!.toUpperCase() + id.slice(1),
          url: `/arcade/${id}/`,
        })),
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Per-game copies of index.html exist only for GitHub Pages; offline, one is enough.
        // Other font subsets load on demand through unicode-range; the interface is Latin.
        globIgnores: ['404.html', '*/index.html', '**/*-{cyrillic,greek,vietnamese}-*.woff2'],
        navigateFallback: '/arcade/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
})
