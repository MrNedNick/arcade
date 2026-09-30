<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import GameShell, { type GameStatus } from '@/components/GameShell.vue'
import { findGame } from '@/games/registry'
import { bindInput, type Action } from '@/engine/input'
import { cssVar, prefersReducedMotion } from '@/engine/motion'
import { play } from '@/engine/sfx'
import { useTheme } from '@/composables/useTheme'
import {
  COLS,
  createGame,
  ghostY,
  hardDrop,
  HIDDEN,
  hold,
  move,
  pieceCells,
  PREVIEW,
  ROWS,
  rotate,
  softDrop,
  tick,
  TYPES,
  type Board,
  type PieceType,
  type TetrisEvent,
  type TetrisState,
} from './logic'

const info = findGame('tetris')!
const VISIBLE = ROWS - HIDDEN
/** Width of each side panel, in board cells. */
const SIDE = 3.4
const CLEAR_MS = 340
const OVER_MS = 700

const status = ref<GameStatus>('ready')
const score = ref(0)
const game = shallowRef<TetrisState>(createGame())

const wrap = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const controls = ref<HTMLDivElement>()

// ── Visual-only state: changes every frame, so plain variables ──
let rafId = 0
let last = 0
let lastDraw = 0
let reduced = prefersReducedMotion()
let fontMono = 'monospace'
let fontDisplay = 'sans-serif'
let shownX = 0
let shownY = 0
let clearing: { rows: number[]; preBoard: Board; at: number } | null = null
let flash: { cells: [number, number][]; at: number } | null = null
let trail: { cells: [number, number][]; distance: number; at: number } | null = null
let bump = { at: 0, power: 0 }
let banner: { text: string; sub?: string; at: number; big: boolean } | null = null
let overAt = 0
interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  at: number
  life: number
  color: string
}
let sparks: Spark[] = []

// ── Colours come from the theme tokens ──
const colors = {
  bg: '',
  grid: '',
  text: '',
  muted: '',
  accent: '',
  piece: {} as Record<PieceType, string>,
}
function readColors() {
  colors.bg = cssVar('--board-bg')
  colors.grid = cssVar('--board-grid')
  colors.text = cssVar('--text')
  colors.muted = cssVar('--text-muted')
  colors.accent = cssVar('--game-tetris')
  for (const t of TYPES) colors.piece[t] = cssVar(`--tetris-${t.toLowerCase()}`)
}
const { theme } = useTheme()
watch(theme, () => requestAnimationFrame(readColors))

// ── Game flow ──
function start() {
  stopRepeat()
  game.value = createGame()
  score.value = 0
  clearing = flash = trail = banner = null
  sparks = []
  overAt = 0
  shownX = game.value.active.x
  shownY = game.value.active.y
  status.value = 'playing'
  last = performance.now()
  play('tap')
}
function pause() {
  if (status.value !== 'playing' || overAt) return
  stopRepeat()
  status.value = 'paused'
}
function resume() {
  if (status.value !== 'paused') return
  last = performance.now()
  status.value = 'playing'
}

const canAct = () => status.value === 'playing' && !clearing && !overAt

function apply(next: TetrisState, events: TetrisEvent[] = []) {
  const a = next.active
  const p = game.value.active
  game.value = next
  score.value = next.score
  // Plain moves glide; a new piece or a (possibly kicked) rotation snaps into place.
  if (a.type !== p.type || a.rot !== p.rot || events.some((e) => e.type === 'lock')) {
    shownX = a.x
    shownY = a.y
  }
  handle(events)
}

function handle(events: TetrisEvent[]) {
  const now = performance.now()
  const dropped = events.some((e) => e.type === 'hardDrop')
  for (const e of events) {
    if (e.type === 'hardDrop') {
      trail = { cells: e.cells, distance: e.distance, at: now }
      bump = { at: now, power: Math.min(1, 0.4 + e.distance / 20) }
    }
    if (e.type === 'lock') {
      flash = { cells: e.cells, at: now }
      if (!dropped) bump = { at: now, power: 0.3 }
      play('tap')
    }
    if (e.type === 'clear') {
      clearing = { rows: e.rows, preBoard: e.preBoard, at: now }
      const n = e.rows.length
      const name = ['', 'Single', 'Double', 'Triple', 'TETRIS!'][n] ?? ''
      banner = { text: name, at: now, big: n === 4 }
      if (!reduced) {
        for (const y of e.rows)
          for (let x = 0; x < COLS; x++)
            for (let k = 0; k < (n === 4 ? 3 : 1); k++)
              sparks.push({
                x: x + 0.5,
                y: y - HIDDEN + 0.5,
                vx: (Math.random() - 0.5) * 8,
                vy: -2 - Math.random() * 6,
                at: now,
                life: 500 + Math.random() * 400,
                color: colors.piece[e.preBoard[y]![x]!],
              })
      }
      play(n === 4 ? 'record' : 'eat')
      navigator.vibrate?.(n === 4 ? [20, 30, 40] : 12)
    }
    if (e.type === 'levelUp') {
      banner = banner?.text
        ? { ...banner, sub: `Level ${e.level}` }
        : { text: `Level ${e.level}`, at: now, big: false }
    }
    if (e.type === 'gameOver') {
      overAt = now
      stopRepeat()
      play('crash')
      navigator.vibrate?.([30, 40, 60])
    }
  }
}

// ── Controls with auto-repeat, like a real Tetris: move once, pause, then slide ──
type Control = 'left' | 'right' | 'down' | 'cw' | 'ccw' | 'drop' | 'hold'
const REPEATS = new Set<Control>(['left', 'right', 'down'])

function act(c: Control) {
  if (!canAct()) return
  const g = game.value
  switch (c) {
    case 'left':
      return apply(move(g, -1))
    case 'right':
      return apply(move(g, 1))
    case 'down':
      return apply(softDrop(g))
    case 'cw':
      return apply(rotate(g, 1))
    case 'ccw':
      return apply(rotate(g, -1))
    case 'drop': {
      const r = hardDrop(g)
      return apply(r.state, r.events)
    }
    case 'hold': {
      const h = hold(g)
      apply(h)
      shownX = h.active.x
      shownY = h.active.y
    }
  }
}

const repeating = new Map<Control, { timer: number; interval: number }>()
function press(c: Control) {
  if (!REPEATS.has(c)) return act(c)
  if (repeating.has(c)) return
  act(c)
  const entry = { timer: 0, interval: 0 }
  entry.timer = window.setTimeout(
    () => {
      entry.interval = window.setInterval(() => act(c), c === 'down' ? 35 : 45)
    },
    c === 'down' ? 60 : 150,
  )
  repeating.set(c, entry)
}
function release(c: Control) {
  const e = repeating.get(c)
  if (!e) return
  clearTimeout(e.timer)
  clearInterval(e.interval)
  repeating.delete(c)
}
function stopRepeat() {
  for (const c of [...repeating.keys()]) release(c)
}

const KEYS: Record<string, Control | 'pause' | 'restart'> = {
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  arrowdown: 'down',
  s: 'down',
  arrowup: 'cw',
  x: 'cw',
  w: 'cw',
  z: 'ccw',
  ' ': 'drop',
  c: 'hold',
  shift: 'hold',
  p: 'pause',
  escape: 'pause',
  r: 'restart',
}

function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
  const k = KEYS[e.key.toLowerCase()]
  if (!k) return
  if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return
  e.preventDefault()
  if (e.repeat) return
  if (k === 'pause') return status.value === 'paused' ? resume() : pause()
  if (k === 'restart') return start()
  if (status.value === 'ready' || status.value === 'over') {
    if (k === 'drop') start()
    return
  }
  if (status.value === 'paused') {
    if (k === 'drop') resume()
    return
  }
  press(k)
}
function onKeyUp(e: KeyboardEvent) {
  const k = KEYS[e.key.toLowerCase()]
  if (k && k !== 'pause' && k !== 'restart') release(k)
}

function onGesture(a: Action) {
  if (a === 'tap') {
    if (status.value === 'playing') act('cw')
    else if (status.value === 'paused') resume()
    return
  }
  if (a === 'left' || a === 'right' || a === 'down') act(a)
  if (a === 'up') act('drop')
}

function padDown(c: Control, e: PointerEvent) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  if (status.value === 'playing') press(c)
}

// ── Rendering ──
let ctx: CanvasRenderingContext2D | null = null
let cell = 24
let W = 0
let H = 0

/** Fits the board into the width and, on phones, into the height left above the pad. */
function resize() {
  const c = canvas.value
  const box = wrap.value
  if (!c || !box) return
  const width = box.clientWidth
  const top = box.getBoundingClientRect().top + window.scrollY
  const pad = controls.value?.offsetHeight ?? 0
  const heightLeft = window.innerHeight - top - pad - 80
  const byWidth = width / (COLS + SIDE * 2 + 0.6)
  const byHeight = Math.max(280, heightLeft) / (VISIBLE + 0.6)
  cell = Math.floor(Math.max(12, Math.min(byWidth, byHeight, 32)))
  W = Math.round(cell * (COLS + SIDE * 2 + 0.6))
  H = Math.round(cell * (VISIBLE + 0.6))
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  c.width = W * dpr
  c.height = H * dpr
  c.style.width = `${W}px`
  c.style.height = `${H}px`
  ctx = c.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function block(
  c: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string,
  alpha = 1,
) {
  const pad = Math.max(1, size * 0.06)
  c.globalAlpha = alpha
  c.fillStyle = color
  c.beginPath()
  c.roundRect(px + pad, py + pad, size - pad * 2, size - pad * 2, size * 0.2)
  c.fill()
  // Light on top, shade at the bottom: a little depth.
  const g = c.createLinearGradient(0, py, 0, py + size)
  g.addColorStop(0, 'rgba(255,255,255,0.3)')
  g.addColorStop(0.5, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.18)')
  c.fillStyle = g
  c.fill()
  c.globalAlpha = 1
}

function miniPiece(
  c: CanvasRenderingContext2D,
  type: PieceType,
  cx: number,
  cy: number,
  size: number,
  alpha = 1,
) {
  const cells = pieceCells({ type, rot: 0, x: 0, y: 0 })
  const minX = Math.min(...cells.map(([x]) => x))
  const minY = Math.min(...cells.map(([, y]) => y))
  const w = Math.max(...cells.map(([x]) => x)) - minX + 1
  const h = Math.max(...cells.map(([, y]) => y)) - minY + 1
  for (const [x, y] of cells)
    block(
      c,
      cx + (x - minX - w / 2) * size,
      cy + (y - minY - h / 2) * size,
      size,
      colors.piece[type],
      alpha,
    )
}

const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2)

function drawSides(c: CanvasRenderingContext2D, g: TetrisState, top: number) {
  const left = (SIDE * cell) / 2
  const right = W - (SIDE * cell) / 2
  const mini = cell * 0.62
  const label = `700 ${Math.max(10, cell * 0.42)}px ${fontMono}`
  c.textAlign = 'center'
  c.fillStyle = colors.muted
  c.font = label
  c.fillText('HOLD', left, top + cell * 0.6)
  c.fillText('NEXT', right, top + cell * 0.6)
  if (g.hold) miniPiece(c, g.hold, left, top + cell * 2.1, mini, g.canHold ? 1 : 0.35)
  g.queue.slice(0, PREVIEW).forEach((t, i) => {
    miniPiece(c, t, right, top + cell * (2.1 + i * 2.6), mini * (i ? 0.85 : 1), i ? 0.7 : 1)
  })
  const stats: [string, number][] = [
    ['LEVEL', g.level],
    ['LINES', g.lines],
  ]
  stats.forEach(([name, value], i) => {
    const y = top + cell * (5 + i * 2.2)
    c.fillStyle = colors.muted
    c.font = label
    c.fillText(name, left, y)
    c.fillStyle = colors.text
    c.font = `700 ${cell * 0.8}px ${fontMono}`
    c.fillText(String(value), left, y + cell * 0.95)
  })
}

function drawStack(c: CanvasRenderingContext2D, g: TetrisState, now: number) {
  if (clearing) {
    // Full rows flash, then shrink away while everything above slides down.
    const t = (now - clearing.at) / CLEAR_MS
    const flashT = Math.min(1, t / 0.4)
    const collapse = t < 0.4 ? 0 : Math.min(1, (t - 0.4) / 0.6)
    const ease = 1 - Math.pow(1 - collapse, 3)
    for (let y = HIDDEN; y < ROWS; y++) {
      const below = clearing.rows.filter((r) => r > y).length
      const dy = (y - HIDDEN + below * ease) * cell
      const cleared = clearing.rows.includes(y)
      for (let x = 0; x < COLS; x++) {
        const t2 = clearing.preBoard[y]![x]
        if (!t2) continue
        if (!cleared) {
          block(c, x * cell, dy, cell, colors.piece[t2])
          continue
        }
        const s = cell * (1 - ease)
        if (s <= 0.5) continue
        block(c, x * cell + (cell - s) / 2, dy + (cell - s) / 2, s, colors.piece[t2])
        c.fillStyle = `rgba(255,255,255,${0.85 * (1 - flashT * 0.3) * (1 - ease)})`
        c.fillRect(x * cell, dy + (cell - s) / 2, cell, s)
      }
    }
    return
  }
  const overT = overAt ? Math.min(1, (now - overAt) / OVER_MS) : 0
  for (let y = HIDDEN; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const t2 = g.board[y]![x]
      if (!t2) continue
      const row = y - HIDDEN
      // Game over: the stack greys out from the bottom up.
      const grey = overT > 0 && overT * 1.4 > (VISIBLE - row) / VISIBLE
      block(c, x * cell, row * cell, cell, grey ? colors.muted : colors.piece[t2], grey ? 0.55 : 1)
    }
}

function drawEffects(c: CanvasRenderingContext2D, now: number) {
  if (flash) {
    const t = (now - flash.at) / 200
    if (t >= 1) flash = null
    else {
      c.fillStyle = `rgba(255,255,255,${0.6 * (1 - t)})`
      for (const [x, y] of flash.cells) {
        c.beginPath()
        c.roundRect(x * cell + 1, (y - HIDDEN) * cell + 1, cell - 2, cell - 2, cell * 0.2)
        c.fill()
      }
    }
  }
  if (trail) {
    const t = (now - trail.at) / 180
    if (t >= 1 || reduced) trail = null
    else {
      const tops = new Map<number, number>()
      for (const [x, y] of trail.cells) tops.set(x, Math.min(tops.get(x) ?? y, y))
      for (const [x, top] of tops) {
        const y1 = (top - HIDDEN) * cell
        const y0 = y1 - trail.distance * cell
        const grad = c.createLinearGradient(0, y0, 0, y1)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(1, `rgba(255,255,255,${0.35 * (1 - t)})`)
        c.fillStyle = grad
        c.fillRect(x * cell + cell * 0.2, y0, cell * 0.6, y1 - y0)
      }
    }
  }
  if (sparks.length) {
    sparks = sparks.filter((s) => now - s.at < s.life)
    for (const s of sparks) {
      const t = (now - s.at) / 1000
      c.globalAlpha = 1 - (now - s.at) / s.life
      c.fillStyle = s.color
      c.fillRect(
        (s.x + s.vx * t) * cell - cell * 0.08,
        (s.y + s.vy * t + 9 * t * t) * cell - cell * 0.08,
        cell * 0.16,
        cell * 0.16,
      )
    }
    c.globalAlpha = 1
  }
}

function drawActive(c: CanvasRenderingContext2D, g: TetrisState, now: number) {
  const a = g.active
  c.strokeStyle = colors.piece[a.type]
  c.globalAlpha = 0.55
  c.lineWidth = Math.max(1.5, cell * 0.07)
  for (const [x, y] of pieceCells({ ...a, y: ghostY(g) })) {
    if (y < HIDDEN) continue
    c.beginPath()
    c.roundRect(
      x * cell + cell * 0.12,
      (y - HIDDEN) * cell + cell * 0.12,
      cell * 0.76,
      cell * 0.76,
      cell * 0.18,
    )
    c.stroke()
  }
  c.globalAlpha = 1
  // Glide towards the real position for a soft, fluid fall.
  const k = reduced ? 1 : 1 - Math.pow(0.001, (now - lastDraw) / 90)
  shownX += (a.x - shownX) * k
  shownY += (a.y - shownY) * k
  if (Math.abs(a.x - shownX) < 0.02) shownX = a.x
  if (Math.abs(a.y - shownY) < 0.02) shownY = a.y
  for (const [x, y] of pieceCells({ ...a, x: 0, y: 0 })) {
    const py = (shownY + y - HIDDEN) * cell
    if (py > -cell) block(c, (shownX + x) * cell, py, cell, colors.piece[a.type])
  }
}

function drawBanner(c: CanvasRenderingContext2D, now: number, cx: number, cy: number) {
  if (!banner) return
  const t = (now - banner.at) / (banner.big ? 1200 : 900)
  if (t >= 1) {
    banner = null
    return
  }
  const scale = reduced ? 1 : easeOutBack(Math.min(1, t / 0.25))
  c.save()
  c.translate(cx, cy)
  c.scale(scale, scale)
  c.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1
  c.textAlign = 'center'
  c.lineWidth = cell * 0.2
  c.lineJoin = 'round'
  c.strokeStyle = colors.bg
  c.font = `800 ${cell * (banner.big ? 1.5 : 1)}px ${fontDisplay}`
  c.strokeText(banner.text, 0, 0)
  c.fillStyle = banner.big ? colors.accent : colors.text
  c.fillText(banner.text, 0, 0)
  if (banner.sub) {
    c.font = `700 ${cell * 0.7}px ${fontDisplay}`
    c.strokeText(banner.sub, 0, cell * 1.1)
    c.fillStyle = colors.accent
    c.fillText(banner.sub, 0, cell * 1.1)
  }
  c.restore()
}

function draw(now: number) {
  const c = ctx
  if (!c) return
  const g = game.value
  c.clearRect(0, 0, W, H)
  const bx = cell * (SIDE + 0.3)
  const by = cell * 0.3
  const bw = COLS * cell
  const bh = VISIBLE * cell
  drawSides(c, g, by)

  const bt = (now - bump.at) / 180
  const bumpY = !reduced && bt < 1 ? Math.sin(bt * Math.PI) * cell * 0.14 * bump.power : 0
  c.save()
  c.translate(bx, by + bumpY)
  c.fillStyle = colors.bg
  c.beginPath()
  c.roundRect(-2, -2, bw + 4, bh + 4, cell * 0.3)
  c.fill()
  c.strokeStyle = colors.grid
  c.lineWidth = 1
  c.stroke()
  c.fillStyle = colors.grid
  for (let y = 0; y < VISIBLE; y++)
    for (let x = 0; x < COLS; x++) {
      c.beginPath()
      c.arc((x + 0.5) * cell, (y + 0.5) * cell, cell * 0.05, 0, Math.PI * 2)
      c.fill()
    }
  c.beginPath()
  c.rect(0, 0, bw, bh)
  c.clip()
  drawStack(c, g, now)
  if (status.value !== 'ready' && !clearing && !overAt) drawActive(c, g, now)
  drawEffects(c, now)
  c.restore()
  drawBanner(c, now, bx + bw / 2, by + bh * 0.4)
}

function frame(now: number) {
  rafId = requestAnimationFrame(frame)
  const dt = Math.min(100, now - last)
  last = now
  if (status.value === 'playing') {
    if (overAt) {
      if (now - overAt >= OVER_MS) status.value = 'over'
    } else if (clearing) {
      if (now - clearing.at >= CLEAR_MS) {
        clearing = null
        shownX = game.value.active.x
        shownY = game.value.active.y
      }
    } else {
      const r = tick(game.value, dt)
      if (r.state !== game.value) apply(r.state, r.events)
    }
  }
  draw(now)
  lastDraw = now
}

let unbind: (() => void) | null = null
let observer: ResizeObserver | null = null
onMounted(() => {
  readColors()
  fontMono = cssVar('--font-mono') || 'monospace'
  fontDisplay = cssVar('--font-display') || 'sans-serif'
  reduced = prefersReducedMotion()
  resize()
  observer = new ResizeObserver(resize)
  if (wrap.value) observer.observe(wrap.value)
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', stopRepeat)
  unbind = bindInput({ surface: canvas.value, onAction: onGesture, keyboard: false, swipeStep: 26 })
  last = lastDraw = performance.now()
  rafId = requestAnimationFrame(frame)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  stopRepeat()
  unbind?.()
  observer?.disconnect()
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', stopRepeat)
})

const PAD: { c: Control; label: string; text?: string }[] = [
  { c: 'hold', label: 'Hold', text: 'Hold' },
  { c: 'ccw', label: 'Rotate left' },
  { c: 'cw', label: 'Rotate right' },
  { c: 'drop', label: 'Hard drop', text: 'Drop' },
  { c: 'left', label: 'Move left' },
  { c: 'down', label: 'Soft drop' },
  { c: 'right', label: 'Move right' },
]
const ICONS: Record<Control, string> = {
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  cw: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4',
  ccw: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4',
  drop: 'M6 5l6 6 6-6M6 12l6 6 6-6',
  hold: 'M7 4h10v16l-5-4-5 4z',
}
</script>

<template>
  <GameShell
    :game="info"
    :status="status"
    :score="score"
    @start="start"
    @pause="pause"
    @resume="resume"
    @restart="start"
  >
    <div ref="wrap" class="wrap">
      <canvas
        ref="canvas"
        class="board"
        role="img"
        :aria-label="`Tetris board. Score ${score}, level ${game.level}, ${game.lines} lines.`"
      />
    </div>
    <template #hint>
      <p class="hint hint--keys">← → move · ↑ rotate · ↓ soft drop · Space drop · C hold</p>
      <p class="hint hint--touch">Tap to rotate · drag to move · flick up to drop</p>
    </template>
    <template #controls>
      <div ref="controls" class="pad" aria-label="Tetris controls">
        <button
          v-for="b in PAD"
          :key="b.c"
          type="button"
          class="pad__btn"
          :class="`pad__btn--${b.c}`"
          :aria-label="b.label"
          @pointerdown="padDown(b.c, $event)"
          @pointerup="release(b.c)"
          @pointercancel="release(b.c)"
          @lostpointercapture="release(b.c)"
          @click.prevent
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="ICONS[b.c]" /></svg>
          <span v-if="b.text">{{ b.text }}</span>
        </button>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.wrap {
  display: flex;
  justify-content: center;
  padding: 6px 0;
}
.board {
  display: block;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
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
  grid-template-columns: repeat(4, 1fr);
  grid-template-areas:
    'hold ccw cw drop'
    'left down down right';
  gap: 6px;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.pad__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 52px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  font-weight: 700;
  font-size: 14px;
  transition:
    transform var(--t-fast) var(--ease-out),
    background var(--t-fast) ease;
}
.pad__btn:active {
  transform: scale(0.93);
  background: color-mix(in srgb, var(--c) 25%, var(--surface));
}
.pad__btn svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.pad__btn--hold {
  grid-area: hold;
}
.pad__btn--ccw {
  grid-area: ccw;
}
.pad__btn--cw {
  grid-area: cw;
}
.pad__btn--drop {
  grid-area: drop;
  color: var(--accent-ink);
  background: var(--c);
  border-color: transparent;
}
.pad__btn--left {
  grid-area: left;
}
.pad__btn--down {
  grid-area: down;
}
.pad__btn--right {
  grid-area: right;
}
</style>
