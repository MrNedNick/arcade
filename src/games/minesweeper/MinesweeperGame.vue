<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import GameShell, { type GameStatus } from '@/components/GameShell.vue'
import { isPageKey } from '@/engine/input'
import { findGame } from '@/games/registry'
import { prefersReducedMotion } from '@/engine/motion'
import { readJSON, writeJSON } from '@/engine/storage'
import { play } from '@/engine/sfx'
import { loadGame, useAutosave } from '@/engine/save'
import { useDaily } from '@/composables/useDaily'
import {
  createGame,
  dailyGame,
  flagsLeft,
  LEVELS,
  reveal,
  toggleFlag,
  type Level,
  type MinesState,
} from './logic'

const info = findGame('minesweeper')!
/** Cap on the opening wave, so big areas still feel quick (28 ms per step, in CSS). */
const WAVE_MAX = 14
const END_MS = 900

const status = ref<GameStatus>('ready')
const levelId = ref<Level['id']>(readJSON<Level['id']>('arcade:minesweeper:level', 'easy'))
watch(levelId, (v) => writeJSON('arcade:minesweeper:level', v))
const level = computed(() => LEVELS.find((l) => l.id === levelId.value) ?? LEVELS[0]!)

const game = shallowRef<MinesState>(
  createGame(level.value.rows, level.value.cols, level.value.mines),
)
const flagMode = ref(false)
const focusIndex = ref(0)
const boardEl = ref<HTMLDivElement>()

// Wave delay per cell (in steps) for the last opening, loss or win.
const delays = shallowRef<Map<number, number>>(new Map())
const shake = ref(false)

// ── Timer: starts on the first reveal, pauses with the game ──
const elapsed = ref(0)
let startedAt = 0
let pausedTotal = 0
let pausedAt = 0
let timerId = 0
function tickTimer() {
  if (!startedAt || status.value !== 'playing' || game.value.outcome !== 'playing') return
  elapsed.value = Math.floor((performance.now() - startedAt - pausedTotal) / 1000)
}

// ── Layout: the hard board lies on its side on wide screens ──
function orientedLevel(): { rows: number; cols: number; mines: number } {
  const l = level.value
  const wide = (boardEl.value?.parentElement?.clientWidth ?? window.innerWidth) >= 700
  return l.id === 'hard' && wide
    ? { rows: l.cols, cols: l.rows, mines: l.mines }
    : { rows: l.rows, cols: l.cols, mines: l.mines }
}

// ── Daily puzzle: medium, the same mines for everyone on a date ──
const daily = useDaily('minesweeper')
const DAILY_LEVEL: Level['id'] = 'medium'
const playingDaily = ref(false)
const boardId = computed(() =>
  playingDaily.value ? 'minesweeper:daily' : `minesweeper:${levelId.value}`,
)
const overNote = computed(() => {
  if (!playingDaily.value) return undefined
  if (outcome.value !== 'won') return 'Same board all day — try again'
  return ['Daily puzzle solved', daily.streakText.value].filter(Boolean).join(' · ')
})
function pickLevel(id: Level['id']) {
  levelId.value = id
  daily.on.value = false
}

// ── Unfinished game: saved when the player leaves, offered back on return ──
interface Saved {
  game: MinesState
  level: Level['id']
  daily: string | null
  elapsed: number
}
const resumed = ref(false)
const { flush } = useAutosave<Saved>('minesweeper', () => {
  if (status.value === 'ready') return undefined
  if (status.value === 'over' || game.value.outcome !== 'playing') return null
  if (!startedAt) return undefined
  tickTimer()
  return {
    game: game.value,
    level: levelId.value,
    daily: playingDaily.value ? daily.date.value : null,
    elapsed: elapsed.value,
  }
})
function restore() {
  const saved = loadGame<Saved>('minesweeper')
  const g = saved?.game
  if (!saved || !g || g.outcome !== 'playing' || g.cells?.length !== g.rows * g.cols) return
  if (daily.on.value && saved.daily !== daily.date.value) return
  game.value = g
  levelId.value = saved.level
  playingDaily.value = saved.daily !== null
  daily.on.value = playingDaily.value
  if (saved.daily) daily.date.value = saved.daily
  elapsed.value = saved.elapsed
  pausedAt = performance.now()
  startedAt = pausedAt - saved.elapsed * 1000
  pausedTotal = 0
  focusIndex.value = Math.floor(g.rows / 2) * g.cols + Math.floor(g.cols / 2)
  resumed.value = true
  status.value = 'paused'
}

function start() {
  resumed.value = false
  playingDaily.value = daily.on.value
  let o = orientedLevel()
  game.value = createGame(o.rows, o.cols, o.mines)
  if (playingDaily.value) {
    const lvl = LEVELS.find((l) => l.id === DAILY_LEVEL)!
    o = lvl
    const d = dailyGame(lvl, daily.random())
    // The daily board starts with its first area already open.
    const { state, opened } = reveal(d.state, d.start)
    game.value = state
    delays.value = new Map(opened.map((x) => [x.index, Math.min(x.distance, WAVE_MAX)]))
  } else delays.value = new Map()
  shake.value = false
  flagMode.value = false
  elapsed.value = 0
  startedAt = pausedTotal = pausedAt = 0
  // The daily board is already open, so its clock runs from the first second.
  if (playingDaily.value) startedAt = performance.now()
  focusIndex.value = Math.floor(o.rows / 2) * o.cols + Math.floor(o.cols / 2)
  status.value = 'playing'
  play('start')
}
function pause() {
  if (status.value !== 'playing' || game.value.outcome !== 'playing') return
  pausedAt = performance.now()
  status.value = 'paused'
  flush()
}
function resume() {
  if (status.value !== 'paused') return
  if (pausedAt) pausedTotal += performance.now() - pausedAt
  pausedAt = 0
  resumed.value = false
  status.value = 'playing'
}

let endTimer = 0
function finish(outcome: 'won' | 'lost', from: number) {
  const g = game.value
  const r0 = Math.floor(from / g.cols)
  const c0 = from % g.cols
  const map = new Map<number, number>()
  g.cells.forEach((cell, i) => {
    if (outcome === 'lost' ? cell.mine || cell.flag : true) {
      const d = Math.max(Math.abs(Math.floor(i / g.cols) - r0), Math.abs((i % g.cols) - c0))
      map.set(i, Math.min(d, 20))
    }
  })
  delays.value = map
  if (outcome === 'lost') {
    shake.value = !prefersReducedMotion()
    play('crash')
  } else {
    play('win')
  }
  endTimer = window.setTimeout(() => (status.value = 'over'), END_MS)
}

function doReveal(i: number) {
  if (status.value !== 'playing') return
  const before = game.value
  if (before.outcome !== 'playing') return
  const { state, opened } = reveal(before, i)
  if (state === before) return
  if (!startedAt) startedAt = performance.now()
  game.value = state
  if (state.outcome === 'playing') {
    delays.value = new Map(opened.map((o) => [o.index, Math.min(o.distance, WAVE_MAX)]))
    play(opened.length > 1 ? 'cascade' : 'reveal')
  }
  if (state.outcome === 'won') {
    elapsed.value = Math.max(1, elapsed.value)
    if (playingDaily.value) daily.solved(elapsed.value)
  }
  if (state.outcome !== 'playing') finish(state.outcome, state.exploded ?? i)
}

function doFlag(i: number) {
  if (status.value !== 'playing' || game.value.outcome !== 'playing') return
  const next = toggleFlag(game.value, i)
  if (next === game.value) return
  game.value = next
  play(next.cells[i]!.flag ? 'flag' : 'unflag')
}

// ── Pointer: click digs, right click or long press flags, flag mode swaps them ──
let pressTimer = 0
let longPressed = false
function onPointerDown(i: number, e: PointerEvent) {
  longPressed = false
  if (e.pointerType === 'mouse') return
  pressTimer = window.setTimeout(() => {
    longPressed = true
    if (flagMode.value) doReveal(i)
    else doFlag(i)
  }, 380)
}
function cancelPress() {
  clearTimeout(pressTimer)
}
function onClick(i: number) {
  focusIndex.value = i
  if (longPressed) {
    longPressed = false
    return
  }
  if (flagMode.value && !game.value.cells[i]!.open) doFlag(i)
  else doReveal(i)
}
function onContext(i: number, e: MouseEvent) {
  e.preventDefault()
  if (!longPressed) doFlag(i)
}

// ── Keyboard: arrows move, Enter/Space dig, F flags ──
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (isPageKey(e)) return
  const k = e.key.toLowerCase()
  if (k === 'p' || k === 'escape') return status.value === 'paused' ? resume() : pause()
  if (k === 'r') return start()
  if (status.value !== 'playing') return
  const g = game.value
  const onBoard = boardEl.value?.contains(document.activeElement)
  const moves: Record<string, [number, number]> = {
    arrowup: [-1, 0],
    arrowdown: [1, 0],
    arrowleft: [0, -1],
    arrowright: [0, 1],
  }
  const m = moves[k]
  if (m) {
    e.preventDefault()
    const r = Math.min(g.rows - 1, Math.max(0, Math.floor(focusIndex.value / g.cols) + m[0]))
    const c = Math.min(g.cols - 1, Math.max(0, (focusIndex.value % g.cols) + m[1]))
    focusIndex.value = r * g.cols + c
    void nextTick(() => cellEls.value[focusIndex.value]?.focus())
    return
  }
  if (k === 'f') {
    e.preventDefault()
    return doFlag(focusIndex.value)
  }
  if ((k === ' ' || k === 'enter') && !onBoard) {
    e.preventDefault()
    doReveal(focusIndex.value)
  }
}

const cellEls = ref<HTMLButtonElement[]>([])

onMounted(() => {
  restore()
  window.addEventListener('keydown', onKey)
  timerId = window.setInterval(tickTimer, 250)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearInterval(timerId)
  clearTimeout(endTimer)
  clearTimeout(pressTimer)
})

const outcome = computed(() => game.value.outcome)
/** Cells grouped in rows, so screen readers can move through the grid row by row. */
const cellRows = computed(() => {
  const g = game.value
  return Array.from({ length: g.rows }, (_, r) =>
    Array.from({ length: g.cols }, (_, k) => ({ i: r * g.cols + k, c: g.cells[r * g.cols + k]! })),
  )
})
const minesLeft = computed(() => {
  if (status.value === 'ready') {
    return daily.on.value ? LEVELS.find((l) => l.id === DAILY_LEVEL)!.mines : level.value.mines
  }
  return outcome.value === 'won' ? 0 : flagsLeft(game.value)
})

function label(i: number): string {
  const g = game.value
  const c = g.cells[i]!
  const pos = `Row ${Math.floor(i / g.cols) + 1}, column ${(i % g.cols) + 1}`
  if (c.open) return `${pos}: ${c.mine ? 'mine' : c.adj ? `${c.adj} mines around` : 'empty'}`
  if (c.flag) return `${pos}: flagged`
  if (g.outcome === 'lost' && c.mine) return `${pos}: mine`
  return `${pos}: hidden`
}
</script>

<template>
  <GameShell
    :game="info"
    :status="status"
    :score="elapsed"
    :board="boardId"
    :counts="outcome === 'won' && !playingDaily"
    :over-title="outcome === 'won' ? (playingDaily ? 'Daily cleared!' : 'Cleared!') : 'Boom'"
    :over-note="overNote"
    :wide="levelId === 'hard' && !playingDaily"
    :resumed="resumed"
    @start="start"
    @pause="pause"
    @resume="resume"
    @restart="start"
  >
    <template #stats>
      <div class="stat-mines" :class="{ 'stat-mines--low': minesLeft < 0 }">
        <span class="stat-mines__label">Mines</span>
        <span class="stat-mines__value">{{ minesLeft }}</span>
      </div>
    </template>

    <div class="area">
      <div
        ref="boardEl"
        class="board"
        :class="{
          'board--shake': shake,
          'board--lost': outcome === 'lost',
          'board--won': outcome === 'won',
        }"
        :style="{ '--cols': game.cols, '--rows': game.rows }"
        role="grid"
        :aria-label="`Minesweeper, ${playingDaily ? 'Daily' : level.label}, ${minesLeft} mines left`"
      >
        <div v-for="(row, r) in cellRows" :key="r" role="row" class="row">
          <button
            v-for="{ i, c } in row"
            :key="i"
            :ref="(el) => (cellEls[i] = el as HTMLButtonElement)"
            type="button"
            class="cell"
            role="gridcell"
            :class="{
              'cell--open': c.open,
              'cell--flag': (c.flag || (outcome === 'won' && c.mine)) && !c.open,
              'cell--mine': outcome === 'lost' && c.mine && !c.flag,
              'cell--boom': game.exploded === i,
              'cell--wrong': outcome === 'lost' && c.flag && !c.mine,
              'cell--wave': delays.has(i),
              [`n${c.adj}`]: c.open && !c.mine && c.adj > 0,
            }"
            :style="delays.has(i) ? { '--d': delays.get(i) } : undefined"
            :tabindex="i === focusIndex ? 0 : -1"
            :aria-label="label(i)"
            @pointerdown="onPointerDown(i, $event)"
            @pointerup="cancelPress"
            @pointerleave="cancelPress"
            @pointercancel="cancelPress"
            @click="onClick(i)"
            @contextmenu="onContext(i, $event)"
            @focus="focusIndex = i"
          >
            <span v-if="c.open && !c.mine && c.adj" class="cell__n" aria-hidden="true">{{
              c.adj
            }}</span>
            <svg
              v-else-if="(c.flag || (outcome === 'won' && c.mine)) && !c.open"
              class="cell__flag"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M6 21V4" />
              <path d="M6 4h11l-3 4 3 4H6z" class="fill" />
            </svg>
            <span
              v-else-if="c.mine && (c.open || outcome === 'lost')"
              class="cell__mine"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </div>

    <template #ready>
      <div class="levels" role="radiogroup" aria-label="Level">
        <button
          v-for="l in LEVELS"
          :key="l.id"
          type="button"
          role="radio"
          class="level"
          :aria-checked="!daily.on.value && levelId === l.id"
          @click="pickLevel(l.id)"
        >
          {{ l.label }}
          <small>{{ l.rows }}×{{ l.cols }} · {{ l.mines }}</small>
        </button>
        <button
          type="button"
          role="radio"
          class="level level--daily"
          :aria-checked="daily.on.value"
          @click="daily.on.value = true"
        >
          <span><span class="star" aria-hidden="true">★</span> Daily</span>
          <small>16×16 · 40</small>
        </button>
      </div>
      <p v-if="daily.on.value" class="daily-note">{{ daily.intro.value }}</p>
    </template>
    <template #hint>
      <p class="hint hint--keys">
        Click to dig · right click to flag · click a number to open around it
      </p>
      <p class="hint hint--touch">Tap to dig · hold to flag</p>
    </template>

    <template #controls>
      <div class="modebar">
        <button
          type="button"
          class="mode"
          :aria-pressed="flagMode"
          :class="{ 'mode--on': flagMode }"
          @click="flagMode = !flagMode"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 21V4" />
            <path d="M6 4h11l-3 4 3 4H6z" class="fill" />
          </svg>
          {{ flagMode ? 'Flag mode: taps place flags' : 'Flag mode' }}
        </button>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.area {
  padding: 12px;
  overflow-x: auto;
}
.row {
  display: contents;
}
.board {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: 3px;
  width: min(100%, calc(var(--cols) * 44px));
  margin: 0 auto;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.board--shake {
  animation: shake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
@keyframes shake {
  15%,
  55% {
    transform: translate(-5px, 2px);
  }
  35%,
  75% {
    transform: translate(5px, -2px);
  }
  90% {
    transform: translate(-2px, 0);
  }
}
.cell {
  position: relative;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 22%;
  background: var(--tile);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.07),
    inset 0 -2px 0 rgba(0, 0, 0, 0.18);
  font-family: var(--font-mono);
  font-weight: 800;
  font-size: clamp(11px, 2.4vw, 20px);
  line-height: 1;
  transition:
    background var(--t-fast) ease,
    transform var(--t-fast) var(--ease-out);
  touch-action: manipulation;
}
.board:not(.board--lost):not(.board--won) .cell:not(.cell--open):hover {
  background: var(--tile-hover);
}
.cell:not(.cell--open):active {
  transform: scale(0.9);
}
.cell:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  z-index: 1;
}
.cell--open {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--board-grid);
  cursor: default;
}
.cell--wave.cell--open {
  animation: reveal 280ms var(--ease-spring) both;
  animation-delay: calc(var(--d) * 28ms);
}
@keyframes reveal {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}
.n1 {
  color: var(--mine-1);
}
.n2 {
  color: var(--mine-2);
}
.n3 {
  color: var(--mine-3);
}
.n4 {
  color: var(--mine-4);
}
.n5 {
  color: var(--mine-5);
}
.n6 {
  color: var(--mine-6);
}
.n7 {
  color: var(--mine-7);
}
.n8 {
  color: var(--mine-8);
}
.cell__flag {
  width: 62%;
  height: 62%;
  fill: none;
  stroke: var(--text);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: plant 320ms var(--ease-spring);
  transform-origin: 25% 90%;
}
.cell__flag .fill {
  fill: var(--game-minesweeper);
  stroke: var(--game-minesweeper);
}
@keyframes plant {
  from {
    transform: scale(0.2) rotate(-25deg);
    opacity: 0;
  }
}
.cell__mine {
  width: 46%;
  height: 46%;
  border-radius: 50%;
  background: var(--text);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--text) 25%, transparent),
    inset -2px -2px 0 rgba(0, 0, 0, 0.35);
}
.cell--mine,
.cell--boom {
  background: color-mix(in srgb, var(--danger) 22%, var(--tile));
}
.cell--wave.cell--mine .cell__mine {
  animation: pop 300ms var(--ease-spring) both;
  animation-delay: calc(80ms + var(--d) * 45ms);
}
.cell--boom {
  background: var(--danger);
  animation: boom 520ms ease-out;
}
.cell--boom .cell__mine {
  background: #fff;
}
@keyframes boom {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 80%, transparent);
    transform: scale(1.25);
  }
  100% {
    box-shadow: 0 0 0 18px transparent;
  }
}
@keyframes pop {
  from {
    transform: scale(0);
  }
}
.cell--wrong::after {
  content: '';
  position: absolute;
  inset: 18%;
  background:
    linear-gradient(45deg, transparent 44%, var(--danger) 44% 56%, transparent 56%),
    linear-gradient(-45deg, transparent 44%, var(--danger) 44% 56%, transparent 56%);
}
.board--won .cell--wave {
  animation: cheer 600ms var(--ease-spring) both;
  animation-delay: calc(var(--d) * 40ms);
}
@keyframes cheer {
  40% {
    transform: translateY(-5px) scale(1.08);
    background: color-mix(in srgb, var(--game-minesweeper) 35%, transparent);
  }
}
.stat-mines {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 58px;
  padding: 6px 10px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.stat-mines__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.stat-mines__value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
}
.stat-mines--low .stat-mines__value {
  color: var(--danger);
}
.levels {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}
.level {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 88px;
  padding: 8px 12px;
  border-radius: 12px;
  font-weight: 700;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  transition: all var(--t) ease;
}
.star {
  color: var(--gold);
}
.daily-note {
  margin: -4px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
}
.level small {
  font-weight: 500;
  font-size: 12px;
}
.level[aria-checked='true'] {
  color: var(--text);
  background: var(--surface);
  box-shadow: 0 0 0 2px var(--c);
}
.hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.hint--touch,
.modebar {
  display: none;
}
@media (pointer: coarse) {
  .hint--keys {
    display: none;
  }
  .hint--touch {
    display: block;
  }
  .modebar {
    display: flex;
    justify-content: center;
  }
}
.mode {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-radius: 14px;
  font-weight: 700;
  background: var(--surface);
  border: 1px solid var(--border);
  transition:
    background var(--t) ease,
    transform var(--t-fast) var(--ease-out);
}
.mode:active {
  transform: scale(0.95);
}
.mode--on {
  background: color-mix(in srgb, var(--c) 22%, var(--surface));
  border-color: var(--c);
}
.mode svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.mode svg .fill {
  fill: var(--game-minesweeper);
  stroke: var(--game-minesweeper);
}
</style>
