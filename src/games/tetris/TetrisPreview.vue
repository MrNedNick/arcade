<template>
  <svg class="preview" viewBox="0 0 160 100" aria-hidden="true">
    <g class="stack">
      <rect x="44" y="82" width="12" height="12" rx="3" style="fill: var(--tetris-j)" />
      <rect x="56" y="82" width="12" height="12" rx="3" style="fill: var(--tetris-j)" />
      <rect x="68" y="82" width="12" height="12" rx="3" style="fill: var(--tetris-s)" />
      <rect x="80" y="82" width="12" height="12" rx="3" style="fill: var(--tetris-s)" />
      <rect x="104" y="82" width="12" height="12" rx="3" style="fill: var(--tetris-z)" />
      <rect x="44" y="70" width="12" height="12" rx="3" style="fill: var(--tetris-j)" />
      <rect x="80" y="70" width="12" height="12" rx="3" style="fill: var(--tetris-s)" />
      <rect x="56" y="70" width="12" height="12" rx="3" style="fill: var(--tetris-j)" />
      <rect x="104" y="70" width="12" height="12" rx="3" style="fill: var(--tetris-z)" />
    </g>
    <rect class="line" x="44" y="82" width="72" height="12" rx="3" />
    <g class="piece">
      <rect x="92" y="2" width="12" height="12" rx="3" />
      <rect x="92" y="14" width="12" height="12" rx="3" />
      <rect x="92" y="26" width="12" height="12" rx="3" />
      <rect x="92" y="38" width="12" height="12" rx="3" />
    </g>
    <rect x="42" y="0" width="76" height="96" rx="4" class="frame" />
  </svg>
</template>

<style scoped>
.preview {
  display: block;
  width: 100%;
  height: 100%;
}
.frame {
  fill: none;
  stroke: var(--board-grid);
  stroke-width: 2;
}
.piece rect {
  fill: var(--tetris-i);
}
/* An I piece falls into the gap, the bottom line flashes, then it all starts again. */
.piece {
  animation: fall 3.2s cubic-bezier(0.5, 0, 0.9, 0.6) infinite;
}
.line {
  fill: #fff;
  opacity: 0;
  animation: flash 3.2s ease-out infinite;
}
@keyframes fall {
  0% {
    transform: translateY(-50px);
  }
  55%,
  100% {
    transform: translateY(44px);
  }
}
@keyframes flash {
  0%,
  55% {
    opacity: 0;
  }
  60% {
    opacity: 0.85;
  }
  80%,
  100% {
    opacity: 0;
  }
}
:global(.card:hover) .piece,
:global(.card:hover) .line {
  animation-duration: 2s;
}
</style>
