import { OPPOSITE, type Direction } from '@/engine/input'

export interface Cell {
  x: number
  y: number
}

export interface SnakeState {
  cols: number
  rows: number
  /** Head first. */
  body: Cell[]
  dir: Direction
  /** Turns pressed faster than the snake moves wait here, at most two. */
  queue: Direction[]
  food: Cell
  score: number
  /** Walls let the snake pass through to the other side. */
  wrap: boolean
  alive: boolean
}

export type StepEvent = 'eat' | 'die'

export type Random = () => number

const DELTA: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const BASE_STEP_MS = 135
export const MIN_STEP_MS = 62

/** Milliseconds per move: starts relaxed and speeds up with every bite. */
export function stepMs(score: number): number {
  return Math.max(MIN_STEP_MS, Math.round(BASE_STEP_MS * Math.pow(0.965, score)))
}

export function createGame(
  opts: { cols?: number; rows?: number; wrap?: boolean } = {},
  random: Random = Math.random,
): SnakeState {
  const cols = opts.cols ?? 17
  const rows = opts.rows ?? 17
  const y = Math.floor(rows / 2)
  const x = Math.floor(cols / 3)
  const body = [
    { x, y },
    { x: x - 1, y },
    { x: x - 2, y },
  ]
  const state: SnakeState = {
    cols,
    rows,
    body,
    dir: 'right',
    queue: [],
    food: { x: 0, y: 0 },
    score: 0,
    wrap: opts.wrap ?? false,
    alive: true,
  }
  state.food = spawnFood(state, random) ?? { x: cols - 3, y }
  return state
}

/** Queues a turn. Reversing onto yourself and repeating the same direction are ignored. */
export function turn(state: SnakeState, dir: Direction): SnakeState {
  const last = state.queue.at(-1) ?? state.dir
  if (dir === last || dir === OPPOSITE[last] || state.queue.length >= 2) return state
  return { ...state, queue: [...state.queue, dir] }
}

export function spawnFood(state: Pick<SnakeState, 'cols' | 'rows' | 'body'>, random: Random) {
  const taken = new Set(state.body.map((c) => c.y * state.cols + c.x))
  const free: Cell[] = []
  for (let y = 0; y < state.rows; y++)
    for (let x = 0; x < state.cols; x++) if (!taken.has(y * state.cols + x)) free.push({ x, y })
  return free.length ? free[Math.floor(random() * free.length)]! : null
}

/** Moves the snake one cell. Pure: returns the next state and what happened. */
export function step(
  state: SnakeState,
  random: Random = Math.random,
): { state: SnakeState; events: StepEvent[] } {
  if (!state.alive) return { state, events: [] }
  const [nextDir = state.dir, ...queue] = state.queue
  const head = state.body[0]!
  let x = head.x + DELTA[nextDir].x
  let y = head.y + DELTA[nextDir].y

  const outside = x < 0 || y < 0 || x >= state.cols || y >= state.rows
  if (outside && !state.wrap) {
    return { state: { ...state, dir: nextDir, queue, alive: false }, events: ['die'] }
  }
  x = (x + state.cols) % state.cols
  y = (y + state.rows) % state.rows

  const eats = x === state.food.x && y === state.food.y
  // The tail moves away this turn unless the snake grows, so it is not an obstacle.
  const obstacles = eats ? state.body : state.body.slice(0, -1)
  if (obstacles.some((c) => c.x === x && c.y === y)) {
    return { state: { ...state, dir: nextDir, queue, alive: false }, events: ['die'] }
  }

  const body = [{ x, y }, ...(eats ? state.body : state.body.slice(0, -1))]
  const next: SnakeState = { ...state, body, dir: nextDir, queue }
  if (!eats) return { state: next, events: [] }

  next.score = state.score + 1
  const food = spawnFood(next, random)
  if (!food) return { state: { ...next, alive: false }, events: ['eat', 'die'] }
  next.food = food
  return { state: next, events: ['eat'] }
}
