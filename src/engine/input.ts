export type Direction = 'up' | 'down' | 'left' | 'right'
/** `tap` is a still touch on the game surface; keyboard Space/Enter is `primary`. */
export type Action = Direction | 'primary' | 'secondary' | 'pause' | 'restart' | 'tap'

const KEYMAP: Record<string, Action> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  ' ': 'primary',
  Enter: 'primary',
  Shift: 'secondary',
  c: 'secondary',
  p: 'pause',
  Escape: 'pause',
  r: 'restart',
}

/** Maps a KeyboardEvent.key to a game action. Letters are case-insensitive. */
export function keyToAction(key: string): Action | null {
  return KEYMAP[key] ?? KEYMAP[key.length === 1 ? key.toLowerCase() : key] ?? null
}

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

/**
 * Turns a finger movement into a direction. Movements shorter than the threshold
 * are taps, not swipes; the dominant axis wins.
 */
export function swipeDirection(dx: number, dy: number, threshold = 24): Direction | null {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (Math.max(ax, ay) < threshold) return null
  if (ax > ay) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

/**
 * Keys that belong to the page rather than the game: typing in a field, or
 * anything while a dialog is open — Escape there has to close the dialog.
 */
export function isPageKey(e: KeyboardEvent): boolean {
  const t = e.target
  if (
    t instanceof HTMLElement &&
    (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
  )
    return true
  return typeof document !== 'undefined' && document.querySelector('dialog[open]') !== null
}

export interface InputOptions {
  /** Element that receives swipes and taps. */
  surface?: HTMLElement | null
  onAction: (action: Action) => void
  /** Continuous swipes: fire a new direction every time the finger travels this far. */
  swipeStep?: number
  /** Set to false when the game handles keys itself (e.g. to auto-repeat on hold). */
  keyboard?: boolean
}

/**
 * One input model for every game: keyboard anywhere on the page, swipes and taps
 * on the game surface. Returns a disposer.
 */
export function bindInput({
  surface,
  onAction,
  swipeStep = 28,
  keyboard = true,
}: InputOptions): () => void {
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || isPageKey(e)) return
    const action = keyToAction(e.key)
    if (!action) return
    // Buttons already react to Space/Enter themselves.
    if (action === 'primary' && e.target instanceof HTMLButtonElement) return
    e.preventDefault()
    onAction(action)
  }

  let start: { x: number; y: number; id: number } | null = null
  let swiped = false

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse') return
    start = { x: e.clientX, y: e.clientY, id: e.pointerId }
    swiped = false
  }
  function onPointerMove(e: PointerEvent) {
    if (!start || e.pointerId !== start.id) return
    const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y, swipeStep)
    if (!dir) return
    onAction(dir)
    swiped = true
    // Re-anchor so a long drag with a bend produces a second turn.
    start = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }
  function onPointerUp(e: PointerEvent) {
    if (!start || e.pointerId !== start.id) return
    if (!swiped) onAction('tap')
    start = null
  }

  if (keyboard) window.addEventListener('keydown', onKey)
  surface?.addEventListener('pointerdown', onPointerDown)
  surface?.addEventListener('pointermove', onPointerMove)
  surface?.addEventListener('pointerup', onPointerUp)
  surface?.addEventListener('pointercancel', onPointerUp)
  return () => {
    window.removeEventListener('keydown', onKey)
    surface?.removeEventListener('pointerdown', onPointerDown)
    surface?.removeEventListener('pointermove', onPointerMove)
    surface?.removeEventListener('pointerup', onPointerUp)
    surface?.removeEventListener('pointercancel', onPointerUp)
  }
}
