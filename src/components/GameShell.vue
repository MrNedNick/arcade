<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AnimatedNumber from './AnimatedNumber.vue'
import TopPlayersDialog from './TopPlayersDialog.vue'
import { formatScore, type GameInfo } from '@/games/registry'
import { scoreBoard } from '@/scores'
import { cleanName, MAX_NAME, useSettings } from '@/composables/useSettings'
import { confetti } from '@/engine/confetti'
import { play } from '@/engine/sfx'

export type GameStatus = 'ready' | 'playing' | 'paused' | 'over'

const props = withDefaults(
  defineProps<{
    game: GameInfo
    status: GameStatus
    score: number
    /** Short label stored with the score, e.g. the game mode. */
    tag?: string
    /** Scoreboard to use when a game keeps one per level; defaults to the game id. */
    board?: string
    /** False when the finished game does not count, e.g. a lost puzzle. */
    counts?: boolean
    /** Heading of the end screen. */
    overTitle?: string
    /** Wider layout for big boards. */
    wide?: boolean
    /** The paused game was restored from the last visit. */
    resumed?: boolean
    /** A line under the final score, e.g. the daily streak. */
    overNote?: string
  }>(),
  // An absent boolean prop would read as false; a finished game counts unless told otherwise.
  { counts: true },
)

const emit = defineEmits<{ start: []; pause: []; resume: []; restart: [] }>()

const settings = useSettings()
const root = ref<HTMLElement>()
const fmt = (n: number) => formatScore(props.game, n)
const boardId = computed(() => props.board ?? props.game.id)

// ── Best score and the end-of-game result ────────────────────────────
const best = ref<number | null>(null)
const rank = ref<number | null>(null)
const savedAt = ref<number | undefined>()
const askName = ref(false)
const nameDraft = ref(settings.name)
const nameInput = ref<HTMLInputElement>()
const showTop = ref(false)
let pending: { score: number; at: number } | null = null

async function refreshBest() {
  best.value = (await scoreBoard.top(boardId.value))[0]?.score ?? null
}
onMounted(refreshBest)
watch(boardId, refreshBest)

const better = (a: number, b: number) => (props.game.order === 'desc' ? a > b : a < b)
// Only point games light up live; a timer is always "better" at the start.
const beatingBest = computed(
  () =>
    props.game.order === 'desc' &&
    props.score > 0 &&
    (best.value === null || better(props.score, best.value)),
)
const shownBest = computed(() => {
  if (props.game.order === 'desc') return Math.max(best.value ?? 0, props.score)
  return best.value ?? -1
})

async function submit(name: string) {
  if (!pending) return
  const { score, at } = pending
  pending = null
  askName.value = false
  const result = await scoreBoard.submit(boardId.value, { name, score, at, tag: props.tag })
  rank.value = result.rank
  savedAt.value = at
  if (result.rank === 1) {
    play('record')
    await nextTick()
    const r = root.value?.querySelector('.stage')?.getBoundingClientRect()
    confetti(r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 3 : undefined)
  }
  await refreshBest()
}

async function onGameOver() {
  rank.value = null
  savedAt.value = undefined
  if (props.score <= 0 || props.counts === false) return
  const at = Date.now()
  const wouldRank = await scoreBoard.rankFor(boardId.value, props.score)
  if (wouldRank === null) return
  pending = { score: props.score, at }
  if (settings.name) {
    await submit(settings.name)
  } else {
    askName.value = true
    nameDraft.value = ''
    await nextTick()
    nameInput.value?.focus()
  }
}

function saveName() {
  const name = cleanName(nameDraft.value)
  if (!name) return nameInput.value?.focus()
  settings.name = name
  void submit(name)
}

watch(
  () => props.status,
  (now, before) => {
    if (now === 'over') void onGameOver()
    // Leaving the end screen without typing a name still keeps the score.
    if (before === 'over' && pending) void submit('Player')
    if (now === 'playing') showTop.value = false
  },
)

// ── Pause when the player looks away ─────────────────────────────────
function autoPause() {
  if (props.status === 'playing') emit('pause')
}
function onVisibility() {
  if (document.hidden) autoPause()
}

// ── Fullscreen ───────────────────────────────────────────────────────
const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled
const isFullscreen = ref(false)
function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === root.value
}
async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen()
  else await root.value?.requestFullscreen().catch(() => undefined)
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('blur', autoPause)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('blur', autoPause)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (pending) void submit(settings.name || 'Player')
})

function toggleSound() {
  settings.sound = !settings.sound
  play('tap')
}

function togglePause() {
  if (props.status === 'playing') emit('pause')
  else if (props.status === 'paused') emit('resume')
}
</script>

<template>
  <div
    ref="root"
    class="shell"
    :class="{ 'shell--fullscreen': isFullscreen, 'shell--wide': wide }"
    :style="{ '--c': `var(${game.color})` }"
  >
    <div class="shell__bar">
      <RouterLink to="/" class="back">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        All games
      </RouterLink>
      <div class="tools">
        <button
          v-if="status === 'playing' || status === 'paused'"
          type="button"
          class="tool"
          :aria-label="status === 'paused' ? 'Resume' : 'Pause'"
          :title="status === 'paused' ? 'Resume (P)' : 'Pause (P)'"
          @click="togglePause"
        >
          <svg v-if="status === 'paused'" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" class="fill" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14" /></svg>
        </button>
        <button
          v-if="status !== 'ready'"
          type="button"
          class="tool"
          aria-label="Restart"
          title="Restart (R)"
          @click="emit('restart')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />
          </svg>
        </button>
        <button
          type="button"
          class="tool"
          :aria-label="settings.sound ? 'Mute sound' : 'Turn sound on'"
          :aria-pressed="settings.sound"
          @click="toggleSound"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9z" class="fill" />
            <path v-if="settings.sound" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
            <path v-else d="M17 9l5 6M22 9l-5 6" />
          </svg>
        </button>
        <button
          v-if="canFullscreen"
          type="button"
          class="tool"
          :aria-label="isFullscreen ? 'Exit full screen' : 'Full screen'"
          @click="toggleFullscreen"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path v-if="!isFullscreen" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            <path v-else d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
          </svg>
        </button>
      </div>
    </div>

    <div class="shell__head">
      <h1 class="title" :style="{ viewTransitionName: `title-${game.id}` }">{{ game.title }}</h1>
      <div class="stats">
        <div class="stat">
          <span class="stat__label">{{ game.scoreLabel }}</span>
          <AnimatedNumber class="stat__value" :value="score" :format="fmt" />
        </div>
        <div class="stat" :class="{ 'stat--gold': beatingBest && status !== 'ready' }">
          <span class="stat__label">Best</span>
          <AnimatedNumber class="stat__value" :value="shownBest" :format="fmt" />
        </div>
        <slot name="stats" />
      </div>
    </div>

    <div class="stage" :style="{ viewTransitionName: `board-${game.id}` }">
      <slot />

      <Transition name="overlay">
        <div v-if="status === 'ready'" class="overlay">
          <p class="overlay__title">{{ game.title }}</p>
          <slot name="ready" />
          <button type="button" class="btn btn--primary" @click="emit('start')">Play</button>
          <slot name="hint" />
        </div>
        <div v-else-if="status === 'paused'" class="overlay">
          <p class="overlay__title">{{ resumed ? 'Welcome back' : 'Paused' }}</p>
          <p v-if="resumed" class="overlay__sub">Your last game is right where you left it.</p>
          <div class="overlay__actions">
            <button type="button" class="btn btn--primary" @click="emit('resume')">
              {{ resumed ? 'Continue' : 'Resume' }}
            </button>
            <button v-if="resumed" type="button" class="btn" @click="emit('restart')">
              New game
            </button>
          </div>
        </div>
        <div v-else-if="status === 'over'" class="overlay overlay--over">
          <p class="overlay__kicker">{{ overTitle ?? 'Game over' }}</p>
          <p class="overlay__score">{{ fmt(score) }}</p>
          <p v-if="overNote" class="overlay__sub">{{ overNote }}</p>
          <Transition name="badge" mode="out-in">
            <form v-if="askName" key="ask" class="name" @submit.prevent="saveName">
              <label for="shell-name" class="name__label">Top 10! What’s your name?</label>
              <div class="name__row">
                <input
                  id="shell-name"
                  ref="nameInput"
                  v-model="nameDraft"
                  class="name__input"
                  :maxlength="MAX_NAME"
                  autocomplete="nickname"
                  placeholder="Your name"
                  enterkeyhint="done"
                />
                <button type="submit" class="btn btn--primary">Save</button>
              </div>
            </form>
            <p v-else-if="rank === 1" key="record" class="badge badge--gold">New record!</p>
            <p v-else-if="rank" key="rank" class="badge">#{{ rank }} on this device</p>
          </Transition>
          <div class="overlay__actions">
            <button type="button" class="btn btn--primary" @click="emit('restart')">
              Play again
            </button>
            <button type="button" class="btn" @click="showTop = true">Top players</button>
          </div>
        </div>
      </Transition>
    </div>

    <slot name="controls" />

    <TopPlayersDialog v-model="showTop" :game="game.id" :board="boardId" :highlight-at="savedAt" />
  </div>
</template>

<style scoped>
.shell {
  --c: var(--accent);
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 560px;
  margin: 0 auto;
}
.shell--wide {
  max-width: 960px;
}
.shell--fullscreen {
  max-width: none;
  justify-content: center;
  align-items: center;
  padding: 16px;
  background: var(--bg);
}
.shell--fullscreen > * {
  width: min(560px, 100%);
}
.shell__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px 6px 2px;
  font-weight: 600;
  font-size: 15px;
  text-decoration: none;
  color: var(--text-muted);
  transition: color var(--t-fast) ease;
}
.back:hover {
  color: var(--text);
}
.back svg,
.tool svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tool svg .fill {
  fill: currentColor;
}
.tools {
  display: flex;
  gap: 6px;
}
.tool {
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
.tool:hover {
  background: var(--surface-2);
}
.tool:active {
  transform: scale(0.9);
}
.shell__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px 12px;
}
.title {
  font-size: clamp(36px, 8vw, 52px);
  font-weight: 700;
  letter-spacing: -0.04em;
}
.stats {
  display: flex;
  gap: 6px;
  margin-left: auto;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 68px;
  padding: 6px 10px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  transition:
    border-color var(--t) ease,
    box-shadow var(--t) ease;
}
.stat--gold {
  border-color: var(--gold);
  box-shadow: 0 0 0 1px var(--gold);
}
.stat--gold .stat__value {
  color: var(--gold);
}
.stat__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.stat__value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
}
.stage {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--board-bg);
  border: 1px solid var(--border);
  box-shadow:
    var(--shadow),
    0 0 0 1px color-mix(in srgb, var(--c) 12%, transparent);
}
.overlay {
  position: absolute;
  inset: 0;
  /* Above the board, including a focused cell that lifts itself with z-index. */
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 20px;
  text-align: center;
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  backdrop-filter: blur(6px);
}
.overlay__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(32px, 7vw, 44px);
  font-weight: 700;
  letter-spacing: -0.03em;
}
.overlay__kicker {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.overlay__sub {
  margin: -6px 0 0;
  color: var(--text-muted);
  font-weight: 600;
}
.overlay__score {
  margin: -8px 0 0;
  font-family: var(--font-mono);
  font-size: clamp(44px, 11vw, 64px);
  font-weight: 800;
  line-height: 1.1;
  color: var(--c);
  animation: score-pop 420ms var(--ease-spring);
}
@keyframes score-pop {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
}
.overlay__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.btn {
  padding: 11px 20px;
  border-radius: 12px;
  font-weight: 700;
  background: var(--surface);
  border: 1px solid var(--border);
  transition:
    transform var(--t-fast) var(--ease-out),
    filter var(--t-fast) ease;
}
.btn:hover {
  filter: brightness(1.08);
}
.btn:active {
  transform: scale(0.95);
}
.btn--primary {
  background: var(--c);
  border-color: transparent;
  color: var(--accent-ink);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--c) 35%, transparent);
}
.badge {
  margin: 0;
  padding: 6px 14px;
  border-radius: 999px;
  font-weight: 700;
  background: var(--surface-2);
}
.badge--gold {
  color: var(--gold-ink);
  background: var(--gold);
  animation: glow 1.6s ease-in-out infinite alternate;
}
@keyframes glow {
  to {
    box-shadow: 0 0 24px color-mix(in srgb, var(--gold) 60%, transparent);
  }
}
.name {
  display: grid;
  gap: 8px;
  width: min(320px, 100%);
}
.name__label {
  font-weight: 700;
  color: var(--gold);
}
.name__row {
  display: flex;
  gap: 6px;
}
.name__input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.name__input:focus {
  outline: 2px solid var(--gold);
  outline-offset: 1px;
}
.overlay-enter-active {
  transition:
    opacity var(--t) ease,
    transform var(--t) var(--ease-spring);
}
.overlay-leave-active {
  transition: opacity var(--t-fast) ease;
}
.overlay-enter-from {
  opacity: 0;
  transform: scale(1.04);
}
.overlay-leave-to {
  opacity: 0;
}
.badge-enter-active {
  transition:
    opacity var(--t) ease,
    transform var(--t-slow) var(--ease-spring);
}
.badge-enter-from {
  opacity: 0;
  transform: scale(0.6);
}
.badge-leave-active {
  transition: opacity var(--t-fast) ease;
}
.badge-leave-to {
  opacity: 0;
}
@media (max-width: 420px) {
  .stat {
    min-width: 58px;
    padding: 5px 8px;
  }
  .stat__value {
    font-size: 18px;
  }
  .tool {
    width: 38px;
    height: 38px;
  }
}
</style>
