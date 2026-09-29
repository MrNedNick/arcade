<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { GAMES, formatScore } from '@/games/registry'
import { scoreBoard } from '@/scores'
import type { ScoreEntry } from '@/scores/scoreboard'

const leaders = ref<Record<string, ScoreEntry | undefined>>({})

onMounted(async () => {
  const tops = await Promise.all(GAMES.map((g) => scoreBoard.top(g.id)))
  leaders.value = Object.fromEntries(GAMES.map((g, i) => [g.id, tops[i]?.[0]]))
})
</script>

<template>
  <section class="lobby">
    <header class="hero">
      <h1 class="hero__title">Arcade</h1>
      <p class="hero__lead">Free games. No ads, no sign-up.</p>
    </header>

    <ul class="grid" role="list">
      <li v-for="(g, i) in GAMES" :key="g.id" class="grid__item" :style="{ '--i': i }">
        <RouterLink :to="`/${g.id}`" class="card" :style="{ '--c': `var(${g.color})` }">
          <div class="card__preview" :style="{ viewTransitionName: `board-${g.id}` }">
            <component :is="g.preview" />
          </div>
          <div class="card__body">
            <h2 class="card__title" :style="{ viewTransitionName: `title-${g.id}` }">
              {{ g.title }}
            </h2>
            <p class="card__tagline">{{ g.tagline }}</p>
            <div class="card__foot">
              <span v-if="leaders[g.id]" class="card__best">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"
                  />
                </svg>
                {{ formatScore(g, leaders[g.id]!.score) }} · {{ leaders[g.id]!.name }}
              </span>
              <span v-else class="card__best card__best--none">No record yet</span>
              <span class="card__play">{{ g.hasSave?.() ? 'Continue' : 'Play' }}</span>
            </div>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.hero {
  margin: 12px 0 28px;
}
.hero__title {
  font-size: clamp(48px, 10vw, 96px);
  font-weight: 700;
  letter-spacing: -0.05em;
  background: linear-gradient(100deg, var(--text) 30%, var(--accent) 60%, var(--accent-2) 90%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: sheen 6s ease-in-out infinite alternate;
}
@keyframes sheen {
  from {
    background-position: 0% 0;
  }
  to {
    background-position: 100% 0;
  }
}
.hero__lead {
  margin: 6px 0 0;
  font-size: clamp(17px, 2.4vw, 21px);
  color: var(--text-muted);
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.grid__item {
  animation: rise 420ms var(--ease-spring) both;
  animation-delay: calc(var(--i) * 60ms);
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
}
.card {
  --c: var(--accent);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  text-decoration: none;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  transition:
    transform var(--t) var(--ease-spring),
    border-color var(--t) ease,
    box-shadow var(--t) ease;
}
.card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--c) 55%, transparent);
  box-shadow:
    var(--shadow),
    0 14px 40px color-mix(in srgb, var(--c) 18%, transparent);
}
.card:active {
  transform: translateY(-1px) scale(0.99);
}
.card__preview {
  aspect-ratio: 16 / 10;
  background: var(--board-bg);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}
.card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 18px 18px;
  flex: 1;
}
.card__title {
  font-size: 26px;
  letter-spacing: -0.03em;
  width: fit-content;
}
.card__tagline {
  margin: 0;
  color: var(--text-muted);
}
.card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 14px;
}
.card__best {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.card__best svg {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--gold);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.card__best--none {
  color: var(--text-muted);
  font-weight: 500;
}
.card__play {
  flex: none;
  padding: 7px 16px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
  color: var(--accent-ink);
  background: var(--c);
  transition: transform var(--t) var(--ease-spring);
}
.card:hover .card__play {
  transform: scale(1.06);
}
</style>
