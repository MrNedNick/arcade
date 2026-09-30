<script setup lang="ts">
// One 3×3 box: numbers drop in one by one, then the box glows as complete.
const digits = [5, 3, 0, 6, 0, 0, 0, 9, 8]
const fill = [5, 3, 4, 6, 7, 2, 1, 9, 8]
const order = [2, 4, 5, 6] // cells the player fills, in this order
</script>

<template>
  <svg class="preview" viewBox="0 0 160 100" aria-hidden="true">
    <rect x="47" y="17" width="66" height="66" rx="8" class="box" />
    <g v-for="(d, i) in fill" :key="i">
      <rect
        :x="49 + (i % 3) * 21"
        :y="19 + Math.floor(i / 3) * 21"
        width="20"
        height="20"
        rx="3"
        class="cell"
      />
      <text
        :x="59 + (i % 3) * 21"
        :y="35 + Math.floor(i / 3) * 21"
        :class="digits[i] ? 'given' : 'user'"
        :style="digits[i] ? undefined : { '--k': order.indexOf(i) }"
      >
        {{ d }}
      </text>
    </g>
    <rect x="47" y="17" width="66" height="66" rx="8" class="glow" />
  </svg>
</template>

<style scoped>
.preview {
  display: block;
  width: 100%;
  height: 100%;
}
.box {
  fill: var(--surface);
  stroke: var(--text-muted);
  stroke-width: 2;
}
.cell {
  fill: transparent;
}
text {
  font: 700 14px var(--font-display);
  text-anchor: middle;
}
.given {
  fill: var(--text);
}
.user {
  fill: var(--game-sudoku);
  transform-box: fill-box;
  transform-origin: center;
  animation: place 4.5s var(--ease-spring) infinite;
  animation-delay: calc(var(--k) * 0.45s);
}
.glow {
  fill: var(--game-sudoku);
  opacity: 0;
  animation: glow 4.5s ease-out infinite;
}
@keyframes place {
  0%,
  6% {
    opacity: 0;
    transform: scale(0.3);
  }
  12%,
  90% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
  }
}
@keyframes glow {
  0%,
  45% {
    opacity: 0;
  }
  52% {
    opacity: 0.35;
  }
  70%,
  100% {
    opacity: 0;
  }
}
</style>
