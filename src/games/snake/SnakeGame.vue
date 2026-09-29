<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import GameShell, { type GameStatus } from '@/components/GameShell.vue'
import { findGame } from '@/games/registry'
import { bindInput, type Action, type Direction } from '@/engine/input'
import { cssVar, prefersReducedMotion } from '@/engine/motion'
import { readJSON, writeJSON } from '@/engine/storage'
import { play } from '@/engine/sfx'
import { useTheme } from '@/composables/useTheme'
import { createGame, step, stepMs, turn, type Cell, type SnakeState } from './logic'

const info = findGame('snake')!
const COLS = 17
const ROWS = 17
const DEATH_MS = 700

const status = ref<GameStatus>('ready')
const score = ref(0)
const wrap = ref(readJSON<boolean>('arcade:snake:wrap', false))
watch(wrap, (v) => writeJSON('arcade:snake:wrap', v))

const canvas = ref<HTMLCanvasElement>()
const game = shallowRef<SnakeState>(createGame({ cols: COLS, rows: ROWS, wrap: wrap.value }))

// ── Timing and animation state (plain variables: they change every frame) ──
let prevBody: Cell[] = game.value.body
let lastStepAt = 0
let pausedAt = 0
let diedAt = 0
let foodBornAt = 0
let rafId = 0
let reduced = prefersReducedMotion()

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  born: number
  size: number
}
let particles: Particle[] = []
let ring: { x: number; y: number; born: number } | null = null
let popup: { x: number; y: number; born: number; text: string } | null = null

// ── Colours come from the theme tokens ──
const colors = { snake: '', food: '', bg: '', grid: '', danger: '', eye: '#fff', pupil: '#0b0d17' }
function readColors() {
  colors.snake = cssVar('--game-snake')
  colors.food = cssVar('--accent-2')
  colors.bg = cssVar('--board-bg')
  colors.grid = cssVar('--board-grid')
  colors.danger = cssVar('--danger')
}
const { theme } = useTheme()
watch(theme, () => requestAnimationFrame(readColors))

// ── Game flow ──
function start() {
  game.value = createGame({ cols: COLS, rows: ROWS, wrap: wrap.value })
  prevBody = game.value.body
  score.value = 0
  particles = []
  ring = popup = null
  diedAt = 0
  const now = performance.now()
  lastStepAt = now
  foodBornAt = now
  status.value = 'playing'
  play('tap')
}

function pause() {
  if (status.value !== 'playing') return
  status.value = 'paused'
  pausedAt = performance.now()
}

function resume() {
  if (status.value !== 'paused') return
  // Shift the clock so the snake continues exactly where it stopped.
  lastStepAt += performance.now() - pausedAt
  status.value = 'playing'
}

function steer(dir: Direction) {
  if (status.value === 'ready') start()
  if (status.value === 'paused') resume()
  if (status.value === 'playing') game.value = turn(game.value, dir)
}

function onAction(action: Action) {
  switch (action) {
    case 'up':
    case 'down':
    case 'left':
    case 'right':
      return steer(action)
    case 'primary':
      if (status.value === 'ready' || status.value === 'over') return start()
      if (status.value === 'paused') return resume()
      return pause()
    case 'tap':
      if (status.value === 'ready' || status.value === 'over') return start()
      if (status.value === 'paused') return resume()
      return
    case 'pause':
      return status.value === 'paused' ? resume() : pause()
    case 'restart':
      return start()
  }
}

function advance(now: number) {
  const g = game.value
  prevBody = g.body
  const result = step(g)
  game.value = result.state
  lastStepAt = now
  const s = result.state
  if (result.events.includes('eat')) {
    score.value = s.score
    burst(g.food, now)
    foodBornAt = now
    play('eat')
    navigator.vibrate?.(8)
  }
  if (result.events.includes('die')) {
    diedAt = now
    play('crash')
    navigator.vibrate?.([30, 40, 60])
  }
}

function burst(at: Cell, now: number) {
  ring = { x: at.x + 0.5, y: at.y + 0.5, born: now }
  popup = { x: at.x + 0.5, y: at.y + 0.5, born: now, text: '+1' }
  if (reduced) return
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4
    const v = 2.2 + Math.random() * 2.6
    particles.push({
      x: at.x + 0.5,
      y: at.y + 0.5,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 380 + Math.random() * 220,
      born: now,
      size: 0.08 + Math.random() * 0.1,
    })
  }
}

// ── Rendering ──
let ctx: CanvasRenderingContext2D | null = null
let size = 0
let cell = 0

function resize() {
  const c = canvas.value
  if (!c) return
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  size = c.clientWidth
  cell = size / COLS
  c.width = Math.round(size * dpr)
  c.height = Math.round(size * dpr)
  ctx = c.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Mixes two #rrggbb colours: t = 0 gives a, t = 1 gives b. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t))
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)

/** Where each segment is right now, between its previous and next cell. */
function interpolated(t: number): { x: number; y: number }[] {
  const g = game.value
  return g.body.map((to, i) => {
    const from = prevBody[i] ?? prevBody[prevBody.length - 1] ?? to
    let fx = from.x
    let fy = from.y
    // Crossing a wrap edge: slide in from outside instead of flying across the board.
    if (to.x - fx > 1) fx += COLS
    if (fx - to.x > 1) fx -= COLS
    if (to.y - fy > 1) fy += ROWS
    if (fy - to.y > 1) fy -= ROWS
    return { x: lerp(fx, to.x, t) + 0.5, y: lerp(fy, to.y, t) + 0.5 }
  })
}

function draw(now: number) {
  if (!ctx) return
  const g = game.value
  const c = ctx
  c.clearRect(0, 0, size, size)

  // Board: soft checkerboard
  c.fillStyle = colors.bg
  c.fillRect(0, 0, size, size)
  c.fillStyle = colors.grid
  for (let y = 0; y < ROWS; y++)
    for (let x = y % 2; x < COLS; x += 2) c.fillRect(x * cell, y * cell, cell, cell)

  const dying = diedAt > 0
  const deathT = dying ? Math.min(1, (now - diedAt) / DEATH_MS) : 0

  c.save()
  if (dying && !reduced) {
    const k = (1 - deathT) * cell * 0.35
    c.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k)
  }

  // Food: pulses, pops in with a spring when it appears
  const born = Math.min(1, (now - foodBornAt) / 260)
  const pulse = reduced ? 1 : 1 + Math.sin(now / 220) * 0.08
  const fr = cell * 0.34 * pulse * (born < 1 ? easeOutBack(born) : 1)
  const fx = (g.food.x + 0.5) * cell
  const fy = (g.food.y + 0.5) * cell
  const glow = c.createRadialGradient(fx, fy, 0, fx, fy, cell * 1.1)
  glow.addColorStop(0, colors.food + '55')
  glow.addColorStop(1, colors.food + '00')
  c.fillStyle = glow
  c.fillRect(fx - cell * 1.1, fy - cell * 1.1, cell * 2.2, cell * 2.2)
  c.fillStyle = colors.food
  c.beginPath()
  c.arc(fx, fy, Math.max(0, fr), 0, Math.PI * 2)
  c.fill()
  c.fillStyle = 'rgba(255,255,255,0.55)'
  c.beginPath()
  c.arc(fx - fr * 0.35, fy - fr * 0.35, Math.max(0, fr * 0.28), 0, Math.PI * 2)
  c.fill()

  // Snake: one smooth tapered tube through the interpolated segment centres
  const t =
    status.value === 'playing' && !dying
      ? Math.min(1, (now - lastStepAt) / stepMs(g.score))
      : dying
        ? 0
        : 1
  const pts = interpolated(t)
  const n = pts.length
  const bodyColor = dying ? colors.danger : colors.snake
  c.lineCap = 'round'
  c.lineJoin = 'round'
  // Opaque colours blended towards the board, so overlapping joints don't show as beads.
  const fade = dying ? deathT * 0.5 : 0
  for (let i = n - 1; i > 0; i--) {
    const a = pts[i]!
    const b = pts[i - 1]!
    if (Math.abs(a.x - b.x) > 1.5 || Math.abs(a.y - b.y) > 1.5) continue
    const k = i / Math.max(1, n - 1)
    c.strokeStyle = mix(bodyColor, colors.bg, Math.min(0.85, fade + k * 0.45))
    c.lineWidth = cell * (0.74 - k * 0.26)
    c.beginPath()
    c.moveTo(a.x * cell, a.y * cell)
    c.lineTo(b.x * cell, b.y * cell)
    c.stroke()
  }

  // Head with eyes that look towards the food
  const head = pts[0]!
  const hx = head.x * cell
  const hy = head.y * cell
  c.fillStyle = mix(bodyColor, colors.bg, dying ? deathT * 0.5 : 0)
  c.shadowColor = bodyColor
  c.shadowBlur = dying ? 0 : cell * 0.6
  c.beginPath()
  c.arc(hx, hy, cell * 0.43, 0, Math.PI * 2)
  c.fill()
  c.shadowBlur = 0
  const dirVec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[g.dir]
  const [dx, dy] = dirVec as [number, number]
  const lookX = fx - hx
  const lookY = fy - hy
  const lookLen = Math.hypot(lookX, lookY) || 1
  for (const side of [-1, 1]) {
    const ex = hx + dx * cell * 0.14 + -dy * side * cell * 0.19
    const ey = hy + dy * cell * 0.14 + dx * side * cell * 0.19
    c.fillStyle = colors.eye
    c.beginPath()
    c.arc(ex, ey, cell * 0.13, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = colors.pupil
    c.beginPath()
    if (dying) {
      // Crossed-out eyes
      c.strokeStyle = colors.pupil
      c.lineWidth = cell * 0.05
      const r = cell * 0.07
      c.moveTo(ex - r, ey - r)
      c.lineTo(ex + r, ey + r)
      c.moveTo(ex + r, ey - r)
      c.lineTo(ex - r, ey + r)
      c.stroke()
    } else {
      c.arc(
        ex + (lookX / lookLen) * cell * 0.05,
        ey + (lookY / lookLen) * cell * 0.05,
        cell * 0.065,
        0,
        Math.PI * 2,
      )
      c.fill()
    }
  }

  // Eat effects: a ring, flying sparks, a floating +1
  if (ring) {
    const rt = (now - ring.born) / 360
    if (rt >= 1) ring = null
    else {
      c.strokeStyle = colors.food
      c.globalAlpha = 1 - rt
      c.lineWidth = cell * 0.1 * (1 - rt)
      c.beginPath()
      c.arc(ring.x * cell, ring.y * cell, cell * (0.35 + rt * 0.9), 0, Math.PI * 2)
      c.stroke()
      c.globalAlpha = 1
    }
  }
  if (particles.length) {
    particles = particles.filter((p) => now - p.born < p.life)
    c.fillStyle = colors.food
    for (const p of particles) {
      const pt = (now - p.born) / p.life
      const dist = 1 - Math.pow(1 - pt, 3)
      c.globalAlpha = 1 - pt
      c.beginPath()
      c.arc(
        (p.x + (p.vx * dist) / 2.4) * cell,
        (p.y + (p.vy * dist) / 2.4) * cell,
        p.size * cell * (1 - pt * 0.5),
        0,
        Math.PI * 2,
      )
      c.fill()
    }
    c.globalAlpha = 1
  }
  if (popup) {
    const pt = (now - popup.born) / 600
    if (pt >= 1) popup = null
    else {
      c.globalAlpha = 1 - pt
      c.fillStyle = colors.snake
      c.font = `700 ${cell * 0.62}px ${cssFontMono}`
      c.textAlign = 'center'
      c.fillText(popup.text, popup.x * cell, (popup.y - 0.6 - pt * 0.9) * cell)
      c.globalAlpha = 1
    }
  }
  c.restore()
}

let cssFontMono = 'monospace'

function frame(now: number) {
  rafId = requestAnimationFrame(frame)
  if (status.value === 'playing') {
    if (diedAt) {
      // The crash plays out first; the snake stays crashed on the board behind the end screen.
      if (now - diedAt >= DEATH_MS) status.value = 'over'
    } else {
      const due = lastStepAt + stepMs(game.value.score)
      // Keep the rhythm steady; after a long stall (tab switch) restart the clock instead.
      if (now >= due && game.value.alive) advance(now - due > 50 ? now : due)
    }
  }
  draw(now)
}

// ── Lifecycle ──
let unbind: (() => void) | null = null
let observer: ResizeObserver | null = null

onMounted(() => {
  readColors()
  cssFontMono = cssVar('--font-mono') || 'monospace'
  reduced = prefersReducedMotion()
  resize()
  observer = new ResizeObserver(resize)
  if (canvas.value) observer.observe(canvas.value)
  unbind = bindInput({ surface: canvas.value, onAction })
  rafId = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  unbind?.()
  observer?.disconnect()
})

// On-screen pad: react on press, not on release, so turns feel instant.
function padPress(dir: Direction, e: PointerEvent) {
  e.preventDefault()
  steer(dir)
}
</script>

<template>
  <GameShell
    :game="info"
    :status="status"
    :score="score"
    :tag="game.wrap ? 'wrap' : undefined"
    @start="start"
    @pause="pause"
    @resume="resume"
    @restart="start"
  >
    <canvas ref="canvas" class="board" role="img" :aria-label="`Snake board. Score ${score}.`" />

    <template #ready>
      <div class="modes" role="radiogroup" aria-label="Walls">
        <button type="button" role="radio" class="mode" :aria-checked="!wrap" @click="wrap = false">
          Solid walls
        </button>
        <button type="button" role="radio" class="mode" :aria-checked="wrap" @click="wrap = true">
          Wrap around
        </button>
      </div>
    </template>
    <template #hint>
      <p class="hint hint--keys">Arrows or WASD to steer · Space to pause</p>
      <p class="hint hint--touch">Swipe on the board or use the pad</p>
    </template>

    <template #controls>
      <div class="pad" aria-label="Direction pad">
        <button
          v-for="d in ['up', 'left', 'right', 'down'] as const"
          :key="d"
          type="button"
          class="pad__btn"
          :class="`pad__btn--${d}`"
          :aria-label="d"
          @pointerdown="padPress(d, $event)"
          @keydown.enter.prevent="steer(d)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14l5-5 5 5" /></svg>
        </button>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.board {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.modes {
  display: inline-flex;
  padding: 4px;
  gap: 4px;
  border-radius: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.mode {
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  transition:
    background var(--t) ease,
    color var(--t) ease;
}
.mode[aria-checked='true'] {
  color: var(--text);
  background: var(--surface);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--c) 60%, transparent);
}
.hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.hint--touch,
.pad {
  display: none;
}
@media (pointer: coarse) {
  .hint--keys {
    display: none;
  }
  .hint--touch {
    display: block;
  }
  .pad {
    display: grid;
  }
}
.pad {
  grid-template-columns: repeat(3, 64px);
  grid-template-rows: repeat(3, 56px);
  gap: 4px;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.pad__btn {
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  transition:
    transform var(--t-fast) var(--ease-out),
    background var(--t-fast) ease;
}
.pad__btn:active {
  transform: scale(0.9);
  background: color-mix(in srgb, var(--c) 25%, var(--surface));
}
.pad__btn svg {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.pad__btn--up {
  grid-area: 1 / 2;
}
.pad__btn--left {
  grid-area: 2 / 1;
}
.pad__btn--left svg {
  transform: rotate(-90deg);
}
.pad__btn--right {
  grid-area: 2 / 3;
}
.pad__btn--right svg {
  transform: rotate(90deg);
}
.pad__btn--down {
  grid-area: 3 / 2;
}
.pad__btn--down svg {
  transform: rotate(180deg);
}
</style>
