<script setup lang="ts">
// A 7×4 field: cells open in a wave from the middle, then a flag pops onto the mine.
const COLS = 7
const ROWS = 4
const numbers: Record<number, number> = { 4: 1, 5: 1, 11: 1, 12: 2, 18: 1, 19: 1 }
const cells = Array.from({ length: COLS * ROWS }, (_, i) => {
  const r = Math.floor(i / COLS)
  const c = i % COLS
  const d = Math.max(Math.abs(r - 1), Math.abs(c - 2))
  return { i, x: 12 + c * 20, y: 10 + r * 20, d, n: numbers[i], mine: i === 13 || i === 6 }
})
</script>

<template>
  <svg class="preview" viewBox="0 0 160 100" aria-hidden="true">
    <g v-for="c in cells" :key="c.i">
      <rect :x="c.x" :y="c.y" width="17" height="17" rx="4" class="tile" />
      <g v-if="!c.mine" class="open" :style="{ '--d': c.d }">
        <rect :x="c.x" :y="c.y" width="17" height="17" rx="4" class="floor" />
        <text v-if="c.n" :x="c.x + 8.5" :y="c.y + 13" :class="`n n${c.n}`">{{ c.n }}</text>
      </g>
      <g v-else class="flag" :style="{ '--d': c.i === 13 ? 4 : 5 }">
        <path :d="`M${c.x + 6} ${c.y + 14}V${c.y + 3}`" class="pole" />
        <path :d="`M${c.x + 6} ${c.y + 3}h7l-2 3 2 3h-7z`" class="cloth" />
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
.tile {
  fill: var(--tile);
}
.floor {
  fill: var(--board-bg);
  stroke: var(--board-grid);
}
.n {
  font: 800 12px var(--font-mono);
  text-anchor: middle;
}
.n1 {
  fill: var(--mine-1);
}
.n2 {
  fill: var(--mine-2);
}
.open,
.flag {
  transform-box: fill-box;
  transform-origin: center;
  animation: open 4s var(--ease-spring) infinite;
  animation-delay: calc(var(--d) * 90ms);
}
.pole {
  stroke: var(--text);
  stroke-width: 1.6;
  stroke-linecap: round;
}
.cloth {
  fill: var(--game-minesweeper);
}
@keyframes open {
  0%,
  8% {
    opacity: 0;
    transform: scale(0.4);
  }
  18%,
  88% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1);
  }
}
</style>
