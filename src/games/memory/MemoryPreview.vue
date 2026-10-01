<script setup lang="ts">
// Four cards: two turn over, they match and give a little hop, then everything resets.
const cards = [
  { x: 20, face: '🦊', k: 0, pair: true },
  { x: 54, face: '', k: -1, pair: false },
  { x: 88, face: '🦊', k: 1, pair: true },
  { x: 122, face: '', k: -1, pair: false },
]
</script>

<template>
  <svg class="preview" viewBox="0 0 160 100" aria-hidden="true">
    <g
      v-for="c in cards"
      :key="c.x"
      :class="['card', { 'card--pair': c.pair }]"
      :style="{ '--k': c.k }"
    >
      <rect :x="c.x" y="30" width="28" height="36" rx="6" class="back" />
      <g v-if="c.pair" class="front">
        <rect :x="c.x" y="30" width="28" height="36" rx="6" class="face" />
        <text :x="c.x + 14" y="54">{{ c.face }}</text>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.preview {
  display: block;
  width: 100%;
  height: 100%;
}
.back {
  fill: var(--game-memory);
}
.face {
  fill: var(--surface);
  stroke: var(--game-memory);
  stroke-width: 1.5;
}
text {
  font-size: 15px;
  text-anchor: middle;
}
.card--pair {
  transform-box: fill-box;
  transform-origin: center;
  animation: turn 3.6s var(--ease-spring) infinite;
  animation-delay: calc(var(--k) * 0.5s);
}
.front {
  opacity: 0;
  animation: show 3.6s steps(1) infinite;
  animation-delay: calc(var(--k) * 0.5s);
}
@keyframes turn {
  0%,
  8% {
    transform: scaleX(1);
  }
  13% {
    transform: scaleX(0);
  }
  18%,
  55% {
    transform: scaleX(1);
  }
  62% {
    transform: translateY(-6px);
  }
  70%,
  100% {
    transform: none;
  }
}
@keyframes show {
  0% {
    opacity: 0;
  }
  13% {
    opacity: 1;
  }
  92% {
    opacity: 0;
  }
}
</style>
