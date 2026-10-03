<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import GameShell, { type GameStatus } from '@/components/GameShell.vue'
import { isPageKey } from '@/engine/input'
import { findGame } from '@/games/registry'
import { readJSON, writeJSON } from '@/engine/storage'
import { play } from '@/engine/sfx'
import { loadGame, useAutosave } from '@/engine/save'
import { useDaily } from '@/composables/useDaily'
import {
  boxOf,
  colOf,
  completedUnits,
  conflicts,
  createState,
  generate,
  hasNote,
  hint,
  isGiven,
  isSolved,
  LEVELS,
  rowOf,
  setValue,
  toggleNote,
  type Level,
  type SudokuState,
} from './logic'

const info = findGame('sudoku')!
const HINT_PENALTY = 30
const WIN_MS = 1300

const status = ref<GameStatus>('ready')
const levelId = ref<Level['id']>(readJSON<Level['id']>('arcade:sudoku:level', 'easy'))
watch(levelId, (v) => writeJSON('arcade:sudoku:level', v))
const level = computed(() => LEVELS.find((l) => l.id === levelId.value) ?? LEVELS[0]!)

const game = shallowRef<SudokuState>(createState(new Array(81).fill(0), new Array(81).fill(0)))
const history = shallowRef<SudokuState[]>([])
const selected = ref<number | null>(null)
const notesMode = ref(false)
const solved = ref(false)
const cellEls = ref<HTMLButtonElement[]>([])

// Animation markers: cell → delay step of the current wave.
const wave = shallowRef<Map<number, number>>(new Map())
const popped = ref<number | null>(null)
const shaking = ref<number | null>(null)
const hinted = ref<number | null>(null)

// ── Timer ──
const elapsed = ref(0)
const penalty = ref(0)
let startedAt = 0
let pausedTotal = 0
let pausedAt = 0
let timerId = 0
function tickTimer() {
  if (status.value !== 'playing' || solved.value || !startedAt) return
  elapsed.value = Math.floor((performance.now() - startedAt - pausedTotal) / 1000) + penalty.value
}

// ── Daily puzzle: medium, the same grid for everyone on a date ──
const daily = useDaily('sudoku')
const DAILY_LEVEL: Level['id'] = 'medium'
const playingDaily = ref(false)
const boardId = computed(() => (playingDaily.value ? 'sudoku:daily' : `sudoku:${levelId.value}`))
const overNote = computed(() => {
  if (!playingDaily.value) return undefined
  return ['Daily puzzle solved', daily.streakText.value].filter(Boolean).join(' · ')
})
function pickLevel(id: Level['id']) {
  levelId.value = id
  daily.on.value = false
}

// ── Unfinished game: saved when the player leaves, offered back on return ──
interface Saved {
  game: SudokuState
  level: Level['id']
  daily: string | null
  elapsed: number
  penalty: number
}
const resumed = ref(false)
const { flush } = useAutosave<Saved>('sudoku', () => {
  if (status.value === 'ready') return undefined
  if (status.value === 'over' || solved.value) return null
  tickTimer()
  return {
    game: game.value,
    level: levelId.value,
    daily: playingDaily.value ? daily.date.value : null,
    elapsed: elapsed.value,
    penalty: penalty.value,
  }
})
function restore() {
  const saved = loadGame<Saved>('sudoku')
  if (!saved || saved.game?.values?.length !== 81 || isSolved(saved.game)) return
  // Opening today's daily from the lobby skips an unrelated unfinished game.
  if (daily.on.value && saved.daily !== daily.date.value) return
  game.value = saved.game
  levelId.value = saved.level
  playingDaily.value = saved.daily !== null
  daily.on.value = playingDaily.value
  if (saved.daily) daily.date.value = saved.daily
  selected.value = saved.game.values.findIndex((v) => v === 0)
  penalty.value = saved.penalty
  elapsed.value = saved.elapsed
  pausedAt = performance.now()
  startedAt = pausedAt - (saved.elapsed - saved.penalty) * 1000
  pausedTotal = 0
  resumed.value = true
  status.value = 'paused'
}

function start() {
  resumed.value = false
  playingDaily.value = daily.on.value
  const lvl = playingDaily.value ? LEVELS.find((l) => l.id === DAILY_LEVEL)! : level.value
  const { puzzle, solution } = generate(lvl, playingDaily.value ? daily.random() : Math.random)
  game.value = createState(puzzle, solution)
  history.value = []
  selected.value = puzzle.findIndex((v) => v === 0)
  notesMode.value = false
  solved.value = false
  wave.value = new Map()
  penalty.value = 0
  elapsed.value = 0
  startedAt = performance.now()
  pausedTotal = pausedAt = 0
  status.value = 'playing'
  play('start')
  void nextTick(() => selected.value !== null && cellEls.value[selected.value]?.focus())
}
function pause() {
  if (status.value !== 'playing' || solved.value) return
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

const canPlay = () => status.value === 'playing' && !solved.value

function commit(next: SudokuState) {
  if (next === game.value) return
  history.value = [...history.value.slice(-199), game.value]
  game.value = next
}

let winTimer = 0
function afterPlace(i: number) {
  const g = game.value
  const v = g.values[i]
  if (!v) return
  popped.value = i
  const wrong = v !== g.solution[i] && conflicts(g.values).has(i)
  if (wrong) {
    shaking.value = i
    play('miss')
    setTimeout(() => (shaking.value = null), 400)
  }
  if (isSolved(g)) return win(i)
  const units = completedUnits(g, i)
  if (units.length) {
    const map = new Map<number, number>()
    for (const u of units)
      u.cells.forEach((c) => {
        const d = Math.max(Math.abs(rowOf(c) - rowOf(i)), Math.abs(colOf(c) - colOf(i)))
        map.set(c, Math.min(map.get(c) ?? 9, d))
      })
    showWave(map)
    play('line')
  } else if (!wrong) play('tap')
}

/** Clears the previous wave for one frame so the CSS animation starts again. */
function showWave(map: Map<number, number>) {
  wave.value = new Map()
  requestAnimationFrame(() => (wave.value = map))
}

function win(from: number) {
  solved.value = true
  tickTimer()
  const map = new Map<number, number>()
  for (let c = 0; c < 81; c++)
    map.set(c, Math.abs(rowOf(c) - rowOf(from)) + Math.abs(colOf(c) - colOf(from)))
  showWave(map)
  play('win')
  if (playingDaily.value) daily.solved(elapsed.value)
  winTimer = window.setTimeout(() => (status.value = 'over'), WIN_MS)
}

function input(v: number) {
  const i = selected.value
  if (!canPlay() || i === null || isGiven(game.value, i)) return
  if (notesMode.value && v) {
    commit(toggleNote(game.value, i, v))
    play('tap')
    return
  }
  const next = setValue(game.value, i, game.value.values[i] === v ? 0 : v)
  commit(next)
  afterPlace(i)
}

function undo() {
  if (!canPlay() || !history.value.length) return
  game.value = history.value.at(-1)!
  history.value = history.value.slice(0, -1)
  play('tap')
}

function useHint() {
  if (!canPlay()) return
  const h = hint(game.value, selected.value)
  if (!h) return
  commit(h.state)
  selected.value = h.cell
  hinted.value = h.cell
  penalty.value += HINT_PENALTY
  tickTimer()
  setTimeout(() => (hinted.value = null), 900)
  afterPlace(h.cell)
}

function select(i: number) {
  selected.value = i
}

// ── Keyboard ──
function onKey(e: KeyboardEvent) {
  if (e.altKey) return
  if (isPageKey(e)) return
  const k = e.key.toLowerCase()
  if ((e.metaKey || e.ctrlKey) && k === 'z') {
    e.preventDefault()
    return undo()
  }
  if (e.metaKey || e.ctrlKey) return
  if (k === 'p' || k === 'escape') return status.value === 'paused' ? resume() : pause()
  if (!canPlay()) return
  if (/^[1-9]$/.test(k)) {
    e.preventDefault()
    return input(Number(k))
  }
  if (k === 'backspace' || k === 'delete' || k === '0') {
    e.preventDefault()
    return input(0)
  }
  if (k === 'n') return (notesMode.value = !notesMode.value)
  if (k === 'u') return undo()
  if (k === 'h') return useHint()
  const moves: Record<string, [number, number]> = {
    arrowup: [-1, 0],
    arrowdown: [1, 0],
    arrowleft: [0, -1],
    arrowright: [0, 1],
  }
  const m = moves[k]
  if (m) {
    e.preventDefault()
    const cur = selected.value ?? 40
    const r = (rowOf(cur) + m[0] + 9) % 9
    const c = (colOf(cur) + m[1] + 9) % 9
    selected.value = r * 9 + c
    void nextTick(() => cellEls.value[selected.value!]?.focus())
  }
}

onMounted(() => {
  restore()
  window.addEventListener('keydown', onKey)
  timerId = window.setInterval(tickTimer, 250)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearInterval(timerId)
  clearTimeout(winTimer)
})

// ── What the board shows ──
const clashes = computed(() => conflicts(game.value.values))
/** Cells grouped in rows, so screen readers can move through the grid row by row. */
const cellRows = computed(() =>
  Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => ({ i: r * 9 + c, v: game.value.values[r * 9 + c]! })),
  ),
)
const selValue = computed(() => (selected.value === null ? 0 : game.value.values[selected.value]!))
function related(i: number): boolean {
  const s = selected.value
  if (s === null || s === i) return false
  return rowOf(s) === rowOf(i) || colOf(s) === colOf(i) || boxOf(s) === boxOf(i)
}
const remaining = computed(() => {
  const counts = new Array(10).fill(9)
  for (const v of game.value.values) if (v) counts[v]--
  return counts as number[]
})

function label(i: number): string {
  const g = game.value
  const pos = `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}`
  const v = g.values[i]
  if (!v) {
    const marks = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => hasNote(g, i, d))
    return `${pos}: empty${marks.length ? `, notes ${marks.join(' ')}` : ''}`
  }
  return `${pos}: ${v}${isGiven(g, i) ? ', given' : ''}${clashes.value.has(i) ? ', conflict' : ''}`
}
</script>

<template>
  <GameShell
    :game="info"
    :status="status"
    :score="elapsed"
    :board="boardId"
    :tag="penalty ? 'hints' : undefined"
    :counts="solved && !playingDaily"
    :over-title="playingDaily ? 'Daily solved!' : 'Solved!'"
    :over-note="overNote"
    :resumed="resumed"
    @start="start"
    @pause="pause"
    @resume="resume"
    @restart="start"
  >
    <div class="area">
      <div
        class="board"
        :class="{ 'board--won': solved }"
        role="grid"
        :aria-label="`Sudoku, ${level.label}`"
      >
        <div v-for="(row, r) in cellRows" :key="r" role="row" class="row">
          <button
            v-for="{ i, v } in row"
            :key="i"
            :ref="(el) => (cellEls[i] = el as HTMLButtonElement)"
            type="button"
            role="gridcell"
            class="cell"
            :class="{
              'cell--given': isGiven(game, i),
              'cell--selected': selected === i,
              'cell--related': related(i),
              'cell--same': !!v && v === selValue && selected !== i,
              'cell--clash': clashes.has(i),
              'cell--pop': popped === i && !!v,
              'cell--shake': shaking === i,
              'cell--hint': hinted === i,
              'cell--wave': wave.has(i),
              'edge-r': colOf(i) === 2 || colOf(i) === 5,
              'edge-b': rowOf(i) === 2 || rowOf(i) === 5,
            }"
            :style="wave.has(i) ? { '--d': wave.get(i) } : undefined"
            :tabindex="selected === i ? 0 : -1"
            :aria-label="label(i)"
            @click="select(i)"
            @focus="select(i)"
          >
            <span v-if="v" :key="v" class="cell__v" aria-hidden="true">{{ v }}</span>
            <span v-else-if="game.notes[i]" class="notes" aria-hidden="true">
              <span v-for="d in 9" :key="d" class="note">{{ hasNote(game, i, d) ? d : '' }}</span>
            </span>
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
        </button>
        <button
          type="button"
          role="radio"
          class="level level--daily"
          :aria-checked="daily.on.value"
          @click="daily.on.value = true"
        >
          <span><span class="star" aria-hidden="true">★</span> Daily</span>
        </button>
      </div>
      <p v-if="daily.on.value" class="daily-note">{{ daily.intro.value }}</p>
    </template>
    <template #hint>
      <p class="hint">1–9 to fill · N for notes · Ctrl+Z to undo · H for a hint (+30 s)</p>
    </template>

    <template #controls>
      <div class="pad" :class="{ 'pad--off': status !== 'playing' || solved }">
        <div class="digits" role="group" aria-label="Numbers">
          <button
            v-for="d in 9"
            :key="d"
            type="button"
            class="digit"
            :class="{ 'digit--done': remaining[d] === 0 }"
            :aria-label="`${notesMode ? 'Note' : 'Place'} ${d}`"
            @click="input(d)"
          >
            {{ d }}
            <small v-if="remaining[d]! > 0" aria-hidden="true">{{ remaining[d] }}</small>
          </button>
        </div>
        <div class="actions">
          <button type="button" class="action" :disabled="!history.length" @click="undo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
            Undo
          </button>
          <button type="button" class="action" @click="input(0)">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 20H9l-5-5 10-10 7 7-6 6M13 20l-7-7" />
            </svg>
            Erase
          </button>
          <button
            type="button"
            class="action"
            :class="{ 'action--on': notesMode }"
            :aria-pressed="notesMode"
            @click="notesMode = !notesMode"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />
            </svg>
            Notes {{ notesMode ? 'on' : 'off' }}
          </button>
          <button type="button" class="action" @click="useHint">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"
              />
            </svg>
            Hint
          </button>
        </div>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.area {
  padding: 10px;
}
.row {
  display: contents;
}
.board {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  width: min(100%, 520px, calc(100dvh - 410px));
  margin: 0 auto;
  border: 2px solid var(--text-muted);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
}
.cell {
  position: relative;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-display);
  font-size: clamp(18px, 5.4vw, 30px);
  font-weight: 600;
  color: var(--game-sudoku);
  transition: background var(--t-fast) ease;
  touch-action: manipulation;
}
.cell:nth-child(9n) {
  border-right: 0;
}
.row:last-child .cell {
  border-bottom: 0;
}
.edge-r {
  border-right: 2px solid var(--text-muted);
}
.edge-b {
  border-bottom: 2px solid var(--text-muted);
}
.cell--given {
  color: var(--text);
  font-weight: 700;
}
.cell--related {
  background: color-mix(in srgb, var(--game-sudoku) 7%, var(--surface));
}
.cell--same {
  background: color-mix(in srgb, var(--game-sudoku) 20%, var(--surface));
}
.cell--selected {
  background: color-mix(in srgb, var(--game-sudoku) 32%, var(--surface));
}
.cell:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.cell--clash:not(.cell--given) {
  color: var(--danger);
}
.cell--clash.cell--given {
  text-decoration: underline wavy var(--danger);
}
.cell--pop .cell__v {
  animation: place 260ms var(--ease-spring);
}
@keyframes place {
  from {
    transform: scale(0.3);
    opacity: 0;
  }
}
.cell--shake .cell__v {
  animation: nope 360ms ease-in-out;
}
@keyframes nope {
  20%,
  60% {
    transform: translateX(-4px);
  }
  40%,
  80% {
    transform: translateX(4px);
  }
}
.cell--hint {
  box-shadow: inset 0 0 0 2px var(--gold);
}
.cell--wave {
  animation: sweep 520ms ease-out both;
  animation-delay: calc(var(--d) * 55ms);
}
@keyframes sweep {
  30% {
    background: color-mix(in srgb, var(--game-sudoku) 55%, var(--surface));
    transform: scale(1.06);
  }
}
.board--won .cell--wave {
  animation: cheer 700ms var(--ease-spring) both;
  animation-delay: calc(var(--d) * 45ms);
}
@keyframes cheer {
  35% {
    background: var(--game-sudoku);
    color: var(--accent-ink);
    transform: scale(1.1);
  }
}
.notes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  height: 100%;
  padding: 2px;
}
.note {
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: clamp(8px, 1.8vw, 11px);
  font-weight: 600;
  color: var(--text-muted);
}
.levels {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
.level {
  min-width: 72px;
  padding: 9px 14px;
  border-radius: 12px;
  font-weight: 700;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  transition: all var(--t) ease;
}
.level[aria-checked='true'] {
  color: var(--text);
  background: var(--surface);
  box-shadow: 0 0 0 2px var(--c);
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
.hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.pad {
  display: grid;
  gap: 8px;
  width: min(100%, 520px, calc(100dvh - 410px));
  margin: 0 auto;
  transition: opacity var(--t) ease;
}
.pad--off {
  opacity: 0.45;
  pointer-events: none;
}
.digits {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 4px;
}
.digit {
  position: relative;
  display: grid;
  place-items: center;
  height: 52px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--game-sudoku);
  transition:
    transform var(--t-fast) var(--ease-out),
    opacity var(--t) ease;
}
.digit small {
  position: absolute;
  right: 5px;
  bottom: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
}
.digit:active,
.action:active {
  transform: scale(0.92);
}
.digit--done {
  opacity: 0.3;
}
.actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 4px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  transition:
    color var(--t) ease,
    background var(--t) ease,
    transform var(--t-fast) var(--ease-out);
}
.action:disabled {
  opacity: 0.4;
}
.action--on {
  color: var(--text);
  background: color-mix(in srgb, var(--c) 18%, var(--surface));
}
.action svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (max-width: 420px) {
  .digit {
    height: 46px;
    font-size: 20px;
  }
  .digit small {
    display: none;
  }
}
</style>
