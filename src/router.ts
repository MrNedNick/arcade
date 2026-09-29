import { createRouter, createWebHistory } from 'vue-router'
import LobbyView from './views/LobbyView.vue'
import { GAME_IDS } from './games/ids'
import { findGame } from './games/registry'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'lobby', component: LobbyView },
    {
      path: `/:game(${GAME_IDS.join('|')})/`,
      alias: `/:game(${GAME_IDS.join('|')})`,
      name: 'game',
      component: () => import('./views/GameView.vue'),
      props: true,
      // A game that is not released yet sends the visitor back to the lobby.
      beforeEnter: (to) => (findGame(to.params.game) ? true : { name: 'lobby' }),
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'lobby' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
