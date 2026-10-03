<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { GAMES, boardsOf, findGame, formatScore, formatTime } from '@/games/registry'
import { hasSave } from '@/engine/save'
import { DAILY_GAMES, dailyResult, streak } from '@/engine/daily'
import { scoreBoard } from '@/scores'
import type { ScoreEntry } from '@/scores/scoreboard'

type Leader = ScoreEntry & { level?: string }
const leaders = ref<Record<string, Leader | undefined>>({})

/** The leader of the first board that has one; for games with levels, say which. */
async function leaderOf(game: (typeof GAMES)[number]): Promise<Leader | undefined> {
  const boards = boardsOf(game)
  for (const b of boards) {
    const top = (await scoreBoard.top(b.id))[0]
    if (top) return { ...top, level: boards.length > 1 ? b.label : undefined }
  }
}

const dailies = computed(() =>
  DAILY_GAMES.map((id) => ({ game: findGame(id)!, result: dailyResult(id) })),
)
const days = computed(() => streak())

onMounted(async () => {
  const found = await Promise.all(GAMES.map(leaderOf))
  leaders.value = Object.fromEntries(GAMES.map((g, i) => [g.id, found[i]]))
})
</script>

<template>
  <section class="lobby">
    <header class="hero">
      <h1 class="hero__title">Arcade</h1>
      <p class="hero__lead">Free games. No ads, no sign-up.</p>
    </header>

    <section class="daily" aria-labelledby="daily-title">
      <div class="daily__head">
        <h2 id="daily-title" class="daily__title">Daily puzzles</h2>
        <span v-if="days" class="daily__streak">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3-1-3 0-6 1-8.5z"
            />
          </svg>
          {{ days === 1 ? '1-day streak' : `${days} days in a row` }}
        </span>
        <span v-else class="daily__sub">Same puzzle for everyone, new one every day</span>
      </div>
      <div class="daily__list">
        <RouterLink
          v-for="d in dailies"
          :key="d.game.id"
          :to="{ path: `/${d.game.id}`, query: { daily: null } }"
          class="daily__item"
          :aria-label="`Daily ${d.game.title}: ${d.result !== null ? `solved in ${formatTime(d.result)}` : 'play today’s puzzle'}`"
          :class="{ 'daily__item--done': d.result !== null }"
          :style="{ '--c': `var(${d.game.color})` }"
        >
          <span class="daily__game">{{ d.game.title }}</span>
          <span class="daily__state">
            <template v-if="d.result !== null">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
              Solved in {{ formatTime(d.result) }}
            </template>
            <template v-else>Play today’s</template>
          </span>
        </RouterLink>
      </div>
    </section>

    <ul class="grid" role="list">
      <li v-for="(g, i) in GAMES" :key="g.id" class="grid__item" :style="{ '--i': i }">
        <RouterLink :to="`/${g.id}`" class="card" :style="{ '--c': `var(${g.color})` }">
          <div
            class="card__preview"
            aria-hidden="true"
            :style="{ viewTransitionName: `board-${g.id}` }"
          >
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
                {{ formatScore(g, leaders[g.id]!.score) }} · {{ leaders[g.id]!.name
                }}<template v-if="leaders[g.id]!.level"> · {{ leaders[g.id]!.level }}</template>
              </span>
              <span v-else class="card__best card__best--none">No record yet</span>
              <span class="card__play">{{ hasSave(g.id) ? 'Continue' : 'Play' }}</span>
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
.daily {
  margin: 0 0 22px;
}
.daily__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  margin-bottom: 10px;
}
.daily__title {
  font-size: 20px;
  letter-spacing: -0.02em;
}
.daily__sub {
  font-size: 14px;
  color: var(--text-muted);
}
.daily__streak {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 700;
  color: var(--gold);
}
.daily__streak svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
.daily__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.daily__item {
  --c: var(--accent);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px 12px 16px;
  border-radius: 14px;
  text-decoration: none;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 4px solid var(--c);
  transition:
    transform var(--t) var(--ease-spring),
    border-color var(--t) ease;
}
.daily__item:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--c) 55%, transparent);
  border-left-color: var(--c);
}
.daily__item:active {
  transform: scale(0.98);
}
.daily__game {
  font-weight: 700;
}
.daily__state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
}
.daily__item--done .daily__state {
  color: var(--text);
}
.daily__state svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--c);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
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
