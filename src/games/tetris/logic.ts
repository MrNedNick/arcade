/**
 * Tetris rules, no Vue: SRS rotation with wall kicks, 7-bag randomizer, hold,
 * ghost piece, lock delay, guideline scoring and gravity. All functions are pure.
 */

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
export type Rotation = 0 | 1 | 2 | 3
export type Board = (PieceType | null)[][]
export type Random = () => number

export const COLS = 10
/** Two hidden rows above the visible 20. */
export const ROWS = 22
export const HIDDEN = 2
export const PREVIEW = 3
export const LOCK_DELAY_MS = 500
export const MAX_LOCK_RESETS = 15

export const TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

/** Spawn orientation cells as [x, y] inside the piece box (3×3, I is 4×4, O is 2×2). */
const SPAWN: Record<PieceType, [number, number][]> = {
  I: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  O: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
}

const BOX: Record<PieceType, number> = { I: 4, O: 2, T: 3, S: 3, Z: 3, J: 3, L: 3 }

/** SRS: rotating clockwise about the box centre gives the four official states. */
function rotateCells(cells: [number, number][], size: number): [number, number][] {
  return cells.map(([x, y]) => [size - 1 - y, x])
}

const SHAPES: Record<PieceType, [number, number][][]> = Object.fromEntries(
  TYPES.map((t) => {
    const states = [SPAWN[t]]
    for (let i = 1; i < 4; i++)
      states.push(t === 'O' ? SPAWN.O : rotateCells(states[i - 1]!, BOX[t]))
    return [t, states]
  }),
) as Record<PieceType, [number, number][][]>

// SRS wall kicks, written with y pointing down (the wiki tables use y up).
type Kicks = Record<string, [number, number][]>
const flip = (k: [number, number][]) => k.map(([x, y]) => [x, -y] as [number, number])
const JLSTZ_KICKS: Kicks = {
  '0>1': flip([
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ]),
  '1>0': flip([
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ]),
  '1>2': flip([
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ]),
  '2>1': flip([
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ]),
  '2>3': flip([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ]),
  '3>2': flip([
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ]),
  '3>0': flip([
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ]),
  '0>3': flip([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ]),
}
const I_KICKS: Kicks = {
  '0>1': flip([
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ]),
  '1>0': flip([
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ]),
  '1>2': flip([
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ]),
  '2>1': flip([
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ]),
  '2>3': flip([
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ]),
  '3>2': flip([
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ]),
  '3>0': flip([
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ]),
  '0>3': flip([
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ]),
}

export interface Piece {
  type: PieceType
  rot: Rotation
  x: number
  y: number
}

export interface TetrisState {
  board: Board
  active: Piece
  hold: PieceType | null
  canHold: boolean
  /** Upcoming pieces; always holds at least PREVIEW + 1. */
  queue: PieceType[]
  score: number
  lines: number
  level: number
  gravityAcc: number
  lockAcc: number
  lockResets: number
  over: boolean
}

export type TetrisEvent =
  | { type: 'lock'; cells: [number, number][]; piece: PieceType }
  | { type: 'hardDrop'; distance: number; cells: [number, number][] }
  | { type: 'clear'; rows: number[]; preBoard: Board }
  | { type: 'levelUp'; level: number }
  | { type: 'gameOver' }

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<PieceType | null>(COLS).fill(null))
}

/** A shuffled bag of all seven pieces: no droughts, no floods. */
export function bag(random: Random): PieceType[] {
  const b = [...TYPES]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[b[i], b[j]] = [b[j]!, b[i]!]
  }
  return b
}

function refill(queue: PieceType[], random: Random): PieceType[] {
  let q = queue
  while (q.length <= PREVIEW + 1) q = [...q, ...bag(random)]
  return q
}

export function pieceCells(p: Piece): [number, number][] {
  return SHAPES[p.type][p.rot]!.map(([x, y]) => [p.x + x, p.y + y])
}

export function fits(board: Board, p: Piece): boolean {
  return pieceCells(p).every(
    ([x, y]) => x >= 0 && x < COLS && y >= 0 && y < ROWS && board[y]![x] === null,
  )
}

function spawnPiece(type: PieceType): Piece {
  // Centred; the top row sits in the last hidden row so the piece shows right away.
  return { type, rot: 0, x: type === 'O' ? 4 : 3, y: HIDDEN - 1 }
}

/** Seconds per row from the guideline curve, as milliseconds. */
export function gravityMs(level: number): number {
  const l = Math.min(level, 20)
  return Math.max(16, Math.pow(0.8 - (l - 1) * 0.007, l - 1) * 1000)
}

export const LINE_POINTS = [0, 100, 300, 500, 800] as const

export function createGame(random: Random = Math.random): TetrisState {
  const queue = refill([], random)
  const [first, ...rest] = queue
  return {
    board: emptyBoard(),
    active: spawnPiece(first!),
    hold: null,
    canHold: true,
    queue: rest,
    score: 0,
    lines: 0,
    level: 1,
    gravityAcc: 0,
    lockAcc: 0,
    lockResets: 0,
    over: false,
  }
}

export function isGrounded(s: TetrisState): boolean {
  return !fits(s.board, { ...s.active, y: s.active.y + 1 })
}

export function ghostY(s: TetrisState): number {
  let y = s.active.y
  while (fits(s.board, { ...s.active, y: y + 1 })) y++
  return y
}

/** Moving or rotating on the ground buys more time, up to a limit. */
function afterManipulation(s: TetrisState, moved: TetrisState): TetrisState {
  if (!isGrounded(moved)) return moved
  if (moved.lockResets >= MAX_LOCK_RESETS) return moved
  return { ...moved, lockAcc: 0, lockResets: moved.lockResets + (isGrounded(s) ? 1 : 0) }
}

export function move(s: TetrisState, dx: number): TetrisState {
  if (s.over) return s
  const next = { ...s.active, x: s.active.x + dx }
  if (!fits(s.board, next)) return s
  return afterManipulation(s, { ...s, active: next })
}

export function rotate(s: TetrisState, dir: 1 | -1): TetrisState {
  if (s.over || s.active.type === 'O') return s
  const from = s.active.rot
  const to = ((from + dir + 4) % 4) as Rotation
  const table = s.active.type === 'I' ? I_KICKS : JLSTZ_KICKS
  for (const [kx, ky] of table[`${from}>${to}`]!) {
    const candidate = { ...s.active, rot: to, x: s.active.x + kx, y: s.active.y + ky }
    if (fits(s.board, candidate)) return afterManipulation(s, { ...s, active: candidate })
  }
  return s
}

export function softDrop(s: TetrisState): TetrisState {
  if (s.over) return s
  const next = { ...s.active, y: s.active.y + 1 }
  if (!fits(s.board, next)) return s
  return { ...s, active: next, score: s.score + 1, gravityAcc: 0 }
}

export function hold(s: TetrisState, random: Random = Math.random): TetrisState {
  if (s.over || !s.canHold) return s
  let queue = s.queue
  let nextType: PieceType
  if (s.hold) nextType = s.hold
  else {
    ;[nextType] = queue as [PieceType]
    queue = refill(queue.slice(1), random)
  }
  const active = spawnPiece(nextType)
  const held = {
    ...s,
    hold: s.active.type,
    canHold: false,
    queue,
    active,
    lockAcc: 0,
    lockResets: 0,
    gravityAcc: 0,
  }
  return fits(s.board, active) ? held : { ...held, over: true }
}

/** Fixes the active piece into the board, clears lines, spawns the next piece. */
function lock(s: TetrisState, random: Random, events: TetrisEvent[]): TetrisState {
  const cells = pieceCells(s.active)
  const preBoard = s.board.map((row) => [...row])
  for (const [x, y] of cells) preBoard[y]![x] = s.active.type
  events.push({ type: 'lock', cells, piece: s.active.type })

  const full = preBoard.flatMap((row, y) => (row.every((c) => c !== null) ? [y] : []))
  let board = preBoard
  if (full.length) {
    board = [
      ...full.map(() => Array<PieceType | null>(COLS).fill(null)),
      ...preBoard.filter((_, y) => !full.includes(y)),
    ]
    events.push({ type: 'clear', rows: full, preBoard })
  }
  const lines = s.lines + full.length
  const level = Math.floor(lines / 10) + 1
  if (level > s.level) events.push({ type: 'levelUp', level })
  const score = s.score + LINE_POINTS[full.length as 0 | 1 | 2 | 3 | 4] * s.level

  const [nextType, ...rest] = s.queue
  const active = spawnPiece(nextType!)
  // Locking entirely inside the hidden rows, or no room to spawn, ends the game.
  const lockedOut = cells.every(([, y]) => y < HIDDEN)
  const next: TetrisState = {
    ...s,
    board,
    active,
    queue: refill(rest, random),
    canHold: true,
    score,
    lines,
    level,
    gravityAcc: 0,
    lockAcc: 0,
    lockResets: 0,
  }
  if (lockedOut || !fits(board, active)) {
    events.push({ type: 'gameOver' })
    return { ...next, over: true }
  }
  return next
}

export function hardDrop(
  s: TetrisState,
  random: Random = Math.random,
): { state: TetrisState; events: TetrisEvent[] } {
  if (s.over) return { state: s, events: [] }
  const y = ghostY(s)
  const distance = y - s.active.y
  const dropped = { ...s, active: { ...s.active, y }, score: s.score + distance * 2 }
  const events: TetrisEvent[] = [{ type: 'hardDrop', distance, cells: pieceCells(dropped.active) }]
  return { state: lock(dropped, random, events), events }
}

/** Advances time: gravity pulls the piece down; a grounded piece locks after the delay. */
export function tick(
  s: TetrisState,
  dt: number,
  random: Random = Math.random,
): { state: TetrisState; events: TetrisEvent[] } {
  if (s.over) return { state: s, events: [] }
  const events: TetrisEvent[] = []
  let state = s
  if (isGrounded(state)) {
    const lockAcc = state.lockAcc + dt
    if (lockAcc >= LOCK_DELAY_MS) return { state: lock(state, random, events), events }
    return { state: { ...state, lockAcc, gravityAcc: 0 }, events }
  }
  let acc = state.gravityAcc + dt
  const g = gravityMs(state.level)
  while (acc >= g && !isGrounded(state)) {
    acc -= g
    state = { ...state, active: { ...state.active, y: state.active.y + 1 } }
  }
  return { state: { ...state, gravityAcc: isGrounded(state) ? 0 : acc }, events }
}
