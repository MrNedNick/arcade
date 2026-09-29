import { nextTick } from 'vue'
import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'
import LobbyView from './views/LobbyView.vue'
import { GAMES } from './games/registry'
import { prefersReducedMotion } from './engine/motion'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'lobby', component: LobbyView },
    // Only released games get a route; any other address falls back to the lobby.
    ...GAMES.map((game) => ({
      path: `/${game.id}`,
      name: game.id,
      component: game.load,
      meta: { game: game.id },
    })),
    { path: '/:pathMatch(.*)*', redirect: { name: 'lobby' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export const supportsViewTransitions =
  typeof document !== 'undefined' && 'startViewTransition' in document

/**
 * Page changes run inside a View Transition: the lobby card morphs into the game
 * board and back. The update callback waits until the new route is rendered.
 */
let finishTransition: (() => void) | null = null

router.beforeResolve((to, from) => {
  if (!supportsViewTransitions || from === START_LOCATION || prefersReducedMotion()) return
  if (to.fullPath === from.fullPath) return
  return new Promise<void>((resolve) => {
    document.startViewTransition(
      () =>
        new Promise<void>((done) => {
          finishTransition = done
          resolve()
        }),
    )
  })
})

router.afterEach(async () => {
  await nextTick()
  finishTransition?.()
  finishTransition = null
})
