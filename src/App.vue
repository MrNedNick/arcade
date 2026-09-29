<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useTheme } from './composables/useTheme'

const { theme, toggle } = useTheme()
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand" aria-label="Arcade — all games">
      <span class="brand__dots" aria-hidden="true"><i /><i /><i /></span>
      <span class="brand__name">Arcade</span>
    </RouterLink>
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
  </header>
  <main class="main">
    <RouterView />
  </main>
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
  padding: 24px 20px 48px;
}
</style>
