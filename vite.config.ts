/// <reference types="vitest/config" />
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
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
  plugins: [vue(), pagesFallback()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
})
