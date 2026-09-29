<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useTheme } from './composables/useTheme'
import TopPlayersDialog from './components/TopPlayersDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import { supportsViewTransitions } from './router'

const { theme, toggle } = useTheme()
const showTop = ref(false)
const showSettings = ref(false)
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand" aria-label="Arcade — all games">
      <span class="brand__dots" aria-hidden="true"><i /><i /><i /></span>
      <span class="brand__name">Arcade</span>
    </RouterLink>
    <nav class="actions" aria-label="Arcade">
      <button type="button" class="icon-btn" aria-label="Top players" @click="showTop = true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"
          />
        </svg>
      </button>
      <button type="button" class="icon-btn" aria-label="Settings" @click="showSettings = true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
          />
        </svg>
      </button>
      <button
        class="icon-btn"
        type="button"
        :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggle"
      >
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </button>
    </nav>
  </header>
  <main class="main">
    <RouterView v-slot="{ Component, route }">
      <!-- With View Transitions the browser animates the swap; otherwise a CSS fade. -->
      <component :is="Component" v-if="supportsViewTransitions" :key="route.path" />
      <Transition v-else name="page" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </main>
  <TopPlayersDialog v-model="showTop" />
  <SettingsDialog v-model="showSettings" />
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1120px;
  margin: 0 auto;
  padding: 16px 20px 0;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 20px;
  letter-spacing: -0.02em;
}
.brand__dots {
  display: inline-flex;
  gap: 3px;
}
.brand__dots i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--accent);
}
.brand__dots i:nth-child(2) {
  opacity: 0.7;
}
.brand__dots i:nth-child(3) {
  opacity: 0.4;
}
.brand:hover .brand__dots i {
  animation: hop 480ms var(--ease-spring);
}
.brand:hover .brand__dots i:nth-child(2) {
  animation-delay: 60ms;
}
.brand:hover .brand__dots i:nth-child(3) {
  animation-delay: 120ms;
}
@keyframes hop {
  40% {
    transform: translateY(-5px);
  }
}
.actions {
  display: flex;
  gap: 6px;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  transition:
    transform var(--t-fast) var(--ease-out),
    background var(--t) ease;
}
.icon-btn:hover {
  background: var(--surface-2);
}
.icon-btn:active {
  transform: scale(0.92);
}
.icon-btn svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.main {
  max-width: 1120px;
  margin: 0 auto;
  padding: 20px 20px 48px;
}
.page-enter-active,
.page-leave-active {
  transition:
    opacity var(--t) ease,
    transform var(--t) var(--ease-out);
}
.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.page-leave-to {
  opacity: 0;
}
</style>
