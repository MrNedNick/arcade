<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import GameShell, { type GameStatus } from '@/components/GameShell.vue'
import { findGame } from '@/games/registry'
import { readJSON, writeJSON } from '@/engine/storage'
import { prefersReducedMotion } from '@/engine/motion'
import { play } from '@/engine/sfx'
import {
  DECKS,
  deal,
  flip,
  hideMiss,
  isFaceUp,
  isWon,
  pairsFound,
  SIZES,
  type MemoryState,
  type Size,
} from './logic'

const info = findGame('memory')!
const MISS_MS = 750
const FLIP_MS = 420
const WIN_MS = 1400

const status = ref<GameStatus>('ready')
const sizeId = ref<Size['id']>(readJSON<Size['id']>('arcade:memory:size', 'small'))
const deckId = ref(readJSON<string>('arcade:memory:deck', 'animals'))
watch(sizeId, (v) => writeJSON('arcade:memory:size', v))
watch(deckId, (v) => writeJSON('arcade:memory:deck', v))
const size = computed(() => SIZES.find((s) => s.id === sizeId.value) ?? SIZES[0]!)
const deck = computed(() => DECKS.find((d) => d.id === deckId.value) ?? DECKS[0]!)

const game = shallowRef<MemoryState>(deal(deck.value.faces, 8, Math.random))
const won = ref(false)
/** Faces stay in the page a moment after turning down, so the flip-back still shows them. */
const showFace = reactive(new Set<number>())
const bump = reactive(new Set<number>())
const shake = reactive(new Set<number>())
const scatter = ref<{ x: number; y: number; r: number }[] | null>(null)

// ── Timer ──
const elapsed = ref(0)
let startedAt = 0
let pausedTotal = 0
let pausedAt = 0
let timerId = 0
function tickTimer() {
  if (!startedAt || status.value !== 'playing' || won.value) return
  elapsed.value = Math.floor((performance.now() - startedAt - pausedTotal) / 1000)
}

const timers = new Set<number>()
function later(fn: () => void, ms: number) {
  const id = window.setTimeout(() => {
    timers.delete(id)
    fn()
  }, ms)
  timers.add(id)
}
function clearTimers() {
  for (const id of timers) clearTimeout(id)
  timers.clear()
}

function start() {
  clearTimers()
  const pairs = (size.value.cols * size.value.rows) / 2
  game.value = deal(deck.value.faces, pairs, Math.random)
  won.value = false
  scatter.value = null
  showFace.clear()
  bump.clear()
  shake.clear()
  elapsed.value = 0
  startedAt = pausedTotal = pausedAt = 0
  status.value = 'playing'
  play('tap')
}
function pause() {
  if (status.value !== 'playing' || won.value) return
  pausedAt = performance.now()
  status.value = 'paused'
}
function resume() {
  if (status.value !== 'paused') return
  if (pausedAt) pausedTotal += performance.now() - pausedAt
  pausedAt = 0
  status.value = 'playing'
}

function turnDown(indices: number[]) {
  later(() => indices.forEach((i) => !isFaceUp(game.value, i) && showFace.delete(i)), FLIP_MS)
}

let missTimer = 0
function tap(i: number) {
  if (status.value !== 'playing' || won.value) return
  const before = game.value
  const closing = before.open.length === 2 ? before.open : []
  const { state, result } = flip(before, i)
  if (result === 'ignored') return
  if (!startedAt) startedAt = performance.now()
  clearTimeout(missTimer)
  game.value = state
  showFace.add(i)
  if (closing.length) turnDown(closing)

  if (result === 'first') play('tap')
  if (result === 'match') {
    const pair = [before.open[0]!, i]
    pair.forEach((k) => bump.add(k))
    later(() => pair.forEach((k) => bump.delete(k)), 600)
    play('eat')
    navigator.vibrate?.(12)
    if (isWon(state)) finish()
  }
  if (result === 'miss') {
    const pair = [...state.open]
    later(() => pair.forEach((k) => shake.add(k)), 380)
    later(() => pair.forEach((k) => shake.delete(k)), 780)
    missTimer = window.setTimeout(() => {
      if (game.value.open.length === 2) {
        game.value = hideMiss(game.value)
        turnDown(pair)
      }
    }, MISS_MS)
  }
}

function finish() {
  won.value = true
  tickTimer()
  elapsed.value = Math.max(1, elapsed.value)
  play('record')
  navigator.vibrate?.([15, 30, 15])
  // After a beat, every card flies off in its own direction.
  later(() => {
    if (prefersReducedMotion()) return
    scatter.value = game.value.cards.map(() => {
      const a = Math.random() * Math.PI * 2
      const d = 220 + Math.random() * 260
      return { x: Math.cos(a) * d, y: Math.sin(a) * d - 80, r: (Math.random() - 0.5) * 540 }
    })
  }, 650)
  later(() => (status.value = 'over'), WIN_MS)
}

// ── Keyboard: arrows move between cards; Space/Enter turn the focused one ──
const cardEls = ref<HTMLButtonElement[]>([])
const focusIndex = ref(0)
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return
  const k = e.key.toLowerCase()
  if (k === 'p' || k === 'escape') return status.value === 'paused' ? resume() : pause()
  if (k === 'r') return start()
  const moves: Record<string, number> = {
    arrowleft: -1,
    arrowright: 1,
    arrowup: -size.value.cols,
    arrowdown: size.value.cols,
  }
  if (status.value !== 'playing' || !(k in moves)) return
  e.preventDefault()
  const n = game.value.cards.length
  focusIndex.value = (focusIndex.value + moves[k]! + n) % n
  cardEls.value[focusIndex.value]?.focus()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  timerId = window.setInterval(tickTimer, 250)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearInterval(timerId)
  clearTimeout(missTimer)
  clearTimers()
})

const found = computed(() => pairsFound(game.value))
const total = computed(() => game.value.cards.length / 2)
</script>

<template>
  <GameShell
    :game="info"
    :status="status"
    :score="elapsed"
    :board="`memory:${sizeId}`"
    :tag="`${game.moves} moves`"
    :counts="won"
    over-title="All pairs found!"
    @start="start"
    @pause="pause"
    @resume="resume"
    @restart="start"
  >
    <template #stats>
      <div class="stat-moves">
        <span class="stat-moves__label">Moves</span>
        <span class="stat-moves__value">{{ game.moves }}</span>
      </div>
    </template>

    <div class="area">
      <div
        class="table"
        :style="{ '--cols': size.cols, '--rows': size.rows }"
        role="grid"
        :aria-label="`Memory, ${found} of ${total} pairs found`"
      >
        <button
          v-for="(c, i) in game.cards"
          :key="i"
          :ref="(el) => (cardEls[i] = el as HTMLButtonElement)"
          type="button"
          role="gridcell"
          class="card"
          :class="{
            'card--up': isFaceUp(game, i),
            'card--matched': c.matched,
            'card--bump': bump.has(i),
            'card--shake': shake.has(i),
            'card--fly': !!scatter,
          }"
          :style="
            scatter
              ? {
                  '--fx': `${scatter[i]!.x}px`,
                  '--fy': `${scatter[i]!.y}px`,
                  '--fr': `${scatter[i]!.r}deg`,
                  '--i': i,
                }
              : { '--i': i }
          "
          :tabindex="i === focusIndex ? 0 : -1"
          :aria-label="
            isFaceUp(game, i)
              ? `Card ${i + 1}: ${c.face}${c.matched ? ', matched' : ''}`
              : `Card ${i + 1}: face down`
          "
          @click="tap(i)"
          @focus="focusIndex = i"
        >
          <span class="card__inner" aria-hidden="true">
            <span class="card__back" />
            <span class="card__front">
              <span v-if="showFace.has(i) || c.matched" class="card__face">{{ c.face }}</span>
            </span>
          </span>
        </button>
      </div>
    </div>

    <template #ready>
      <div class="pickers">
        <div class="picker" role="radiogroup" aria-label="Board size">
          <button
            v-for="s in SIZES"
            :key="s.id"
            type="button"
            role="radio"
            class="chip"
            :aria-checked="sizeId === s.id"
            @click="sizeId = s.id"
          >
            {{ s.label }}
          </button>
        </div>
        <div class="picker" role="radiogroup" aria-label="Cards">
          <button
            v-for="d in DECKS"
            :key="d.id"
            type="button"
            role="radio"
            class="chip"
            :aria-checked="deckId === d.id"
            @click="deckId = d.id"
          >
            <span aria-hidden="true">{{ d.faces[0] }}</span> {{ d.label }}
          </button>
        </div>
      </div>
    </template>
    <template #hint>
      <p class="hint">Turn two cards at a time and find every pair</p>
    </template>
  </GameShell>
</template>

<style scoped>
.area {
  padding: 12px;
}
.table {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: clamp(5px, 1.4vw, 10px);
  width: min(100%, calc(var(--cols) * 104px), calc((100dvh - 330px) * var(--cols) / var(--rows)));
  margin: 0 auto;
}
.card {
  aspect-ratio: 1;
  perspective: 700px;
  touch-action: manipulation;
  border-radius: 16%;
}
.card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.card__inner {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 420ms var(--ease-spring);
}
.card--up .card__inner {
  transform: rotateY(180deg);
}
.card__back,
.card__front {
  position: absolute;
  inset: 0;
  border-radius: 16%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.card__back {
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.22), transparent 45%),
    repeating-linear-gradient(
      45deg,
      color-mix(in srgb, var(--game-memory) 85%, #000) 0 6px,
      var(--game-memory) 6px 12px
    );
  box-shadow:
    inset 0 0 0 3px rgba(255, 255, 255, 0.18),
    0 4px 10px rgba(0, 0, 0, 0.18);
  transition: transform var(--t) var(--ease-spring);
}
.card:not(.card--up):hover .card__back {
  transform: translateY(-3px) rotate(-1.5deg);
}
.card:not(.card--up):active .card__back {
  transform: scale(0.94);
}
.card__front {
  display: grid;
  place-items: center;
  transform: rotateY(180deg);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}
.card__face {
  font-size: clamp(22px, calc(52vw / var(--cols)), 54px);
  line-height: 1;
}
.card--matched .card__front {
  border-color: color-mix(in srgb, var(--game-memory) 70%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--game-memory) 45%, transparent);
}
.card--bump {
  animation: snap 520ms var(--ease-spring);
}
@keyframes snap {
  30% {
    transform: scale(1.12);
  }
  55% {
    transform: scale(0.96);
  }
}
.card--shake {
  animation: no 380ms ease-in-out;
}
@keyframes no {
  20%,
  60% {
    transform: translateX(-6px) rotate(-2deg);
  }
  40%,
  80% {
    transform: translateX(6px) rotate(2deg);
  }
}
.card--fly {
  animation: fly 720ms cubic-bezier(0.55, 0, 0.8, 0.4) forwards;
  animation-delay: calc(var(--i) * 14ms);
}
@keyframes fly {
  to {
    transform: translate(var(--fx), var(--fy)) rotate(var(--fr)) scale(0.6);
    opacity: 0;
  }
}
.stat-moves {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 58px;
  padding: 6px 10px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.stat-moves__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.stat-moves__value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
}
.pickers {
  display: grid;
  gap: 8px;
  justify-items: center;
}
.picker {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
.chip {
  padding: 8px 14px;
  border-radius: 12px;
  font-weight: 700;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  transition: all var(--t) ease;
}
.chip[aria-checked='true'] {
  color: var(--text);
  background: var(--surface);
  box-shadow: 0 0 0 2px var(--c);
}
.hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
