<template>
  <svg class="preview" viewBox="0 0 160 100" aria-hidden="true">
    <defs>
      <pattern id="snake-cells" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" class="cell" />
        <rect x="10" y="10" width="10" height="10" class="cell" />
      </pattern>
    </defs>
    <rect width="160" height="100" fill="url(#snake-cells)" />
    <circle class="food" cx="125" cy="25" r="5" />
    <path
      class="snake"
      pathLength="100"
      d="M15 75 H65 V45 H95 V75 H145 V55 Q145 45 135 45 H115 V25 H35 Q25 25 25 35 V75 Z"
    />
  </svg>
</template>

<style scoped>
.preview {
  display: block;
  width: 100%;
  height: 100%;
}
.cell {
  fill: var(--board-grid);
}
.snake {
  fill: none;
  stroke: var(--game-snake);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 24 76;
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--game-snake) 60%, transparent));
  animation: crawl 5s linear infinite;
}
.food {
  fill: var(--accent-2);
  transform-origin: 125px 25px;
  animation: pulse 900ms ease-in-out infinite alternate;
}
@keyframes crawl {
  to {
    stroke-dashoffset: -100;
  }
}
@keyframes pulse {
  to {
    transform: scale(1.25);
  }
}
:global(.card:hover) .snake {
  animation-duration: 2.6s;
}
</style>
