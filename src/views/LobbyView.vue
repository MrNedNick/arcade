<script setup lang="ts">
import { GAMES } from '@/games/registry'
</script>

<template>
  <section class="lobby">
    <h1 class="lobby__title">Arcade</h1>
    <p class="lobby__lead">Free games. No ads, no sign-up.</p>
    <p v-if="!GAMES.length" class="lobby__empty">The first game is on its way.</p>
  </section>
</template>

<style scoped>
.lobby__title {
  font-size: clamp(44px, 9vw, 88px);
  font-weight: 700;
  letter-spacing: -0.04em;
}
.lobby__lead {
  margin: 8px 0 0;
  font-size: clamp(17px, 2.4vw, 21px);
  color: var(--text-muted);
}
.lobby__empty {
  margin-top: 40px;
  color: var(--text-muted);
}
</style>
