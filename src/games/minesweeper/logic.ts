/** Minesweeper rules, no Vue. Cells are a flat array, index = row * cols + col. */

export interface Cell {
  mine: boolean
  /** Mines around this cell. */
  adj: number
  open: boolean
  flag: boolean
}

export type Outcome = 'playing' | 'won' | 'lost'

export interface MinesState {
  rows: number
  cols: number
  mines: number
  cells: Cell[]
  /** Mines are laid on the first reveal, so the first click is always safe. */
  laid: boolean
  outcome: Outcome
  /** The mine that went off. */
  exploded: number | null
}

export interface Level {
  id: 'easy' | 'medium' | 'hard'
  label: string
  rows: number
  cols: number
  mines: number
}

export const LEVELS: Level[] = [
  { id: 'easy', label: 'Easy', rows: 9, cols: 9, mines: 10 },
  { id: 'medium', label: 'Medium', rows: 16, cols: 16, mines: 40 },
  { id: 'hard', label: 'Hard', rows: 30, cols: 16, mines: 99 },
]

export type Random = () => number

/** A cell that opened, and how many steps it is from where the player clicked. */
export interface Opened {
  index: number
  distance: number
}

export function createGame(rows: number, cols: number, mines: number): MinesState {
  return {
    rows,
    cols,
    mines,
    cells: Array.from({ length: rows * cols }, () => ({
      mine: false,
      adj: 0,
      open: false,
      flag: false,
    })),
    laid: false,
    outcome: 'playing',
    exploded: null,
  }
}

export function neighbours(s: Pick<MinesState, 'rows' | 'cols'>, i: number): number[] {
  const r = Math.floor(i / s.cols)
  const c = i % s.cols
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < s.rows && nc >= 0 && nc < s.cols) out.push(nr * s.cols + nc)
    }
  return out
}

/** Lays mines anywhere except the first click and, when there is room, its neighbours. */
export function layMines(s: MinesState, safe: number, random: Random): MinesState {
  const keepClear = new Set([safe, ...neighbours(s, safe)])
  let pool = s.cells.map((_, i) => i).filter((i) => !keepClear.has(i))
  if (pool.length < s.mines) pool = s.cells.map((_, i) => i).filter((i) => i !== safe)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  const mines = new Set(pool.slice(0, s.mines))
  const cells = s.cells.map((c, i) => ({ ...c, mine: mines.has(i), adj: 0 }))
  for (let i = 0; i < cells.length; i++)
    cells[i]!.adj = neighbours(s, i).filter((n) => mines.has(n)).length
  return { ...s, cells, laid: true }
}

function withOutcome(s: MinesState): MinesState {
  if (s.outcome !== 'playing') return s
  const won = s.cells.every((c) => c.mine || c.open)
  return won ? { ...s, outcome: 'won' } : s
}

/** Opens cells starting from `starts`; empty cells spread the opening outwards. */
function open(s: MinesState, starts: number[]): { state: MinesState; opened: Opened[] } {
  const cells = s.cells.map((c) => ({ ...c }))
  const opened: Opened[] = []
  const queue: Opened[] = []
  for (const i of starts) {
    const c = cells[i]!
    if (c.open || c.flag) continue
    c.open = true
    opened.push({ index: i, distance: 0 })
    queue.push({ index: i, distance: 0 })
  }
  let exploded: number | null = null
  for (let q = 0; q < queue.length; q++) {
    const { index, distance } = queue[q]!
    const c = cells[index]!
    if (c.mine) {
      exploded ??= index
      continue
    }
    if (c.adj !== 0) continue
    for (const n of neighbours(s, index)) {
      const nc = cells[n]!
      if (nc.open || nc.flag || nc.mine) continue
      nc.open = true
      opened.push({ index: n, distance: distance + 1 })
      queue.push({ index: n, distance: distance + 1 })
    }
  }
  if (exploded !== null) {
    return { state: { ...s, cells, outcome: 'lost', exploded }, opened }
  }
  return { state: withOutcome({ ...s, cells }), opened }
}

export function reveal(
  s: MinesState,
  i: number,
  random: Random = Math.random,
): { state: MinesState; opened: Opened[] } {
  if (s.outcome !== 'playing') return { state: s, opened: [] }
  const cell = s.cells[i]
  if (!cell || cell.flag) return { state: s, opened: [] }
  if (cell.open) return chord(s, i)
  const ready = s.laid ? s : layMines(s, i, random)
  return open(ready, [i])
}

/**
 * Clicking an open number whose mines are all flagged opens every other neighbour
 * at once. A wrong flag makes this lose, as in the classic game.
 */
export function chord(s: MinesState, i: number): { state: MinesState; opened: Opened[] } {
  const cell = s.cells[i]
  if (s.outcome !== 'playing' || !cell?.open || cell.adj === 0) return { state: s, opened: [] }
  const around = neighbours(s, i)
  const flags = around.filter((n) => s.cells[n]!.flag).length
  if (flags !== cell.adj) return { state: s, opened: [] }
  return open(
    s,
    around.filter((n) => !s.cells[n]!.open && !s.cells[n]!.flag),
  )
}

export function toggleFlag(s: MinesState, i: number): MinesState {
  const cell = s.cells[i]
  if (s.outcome !== 'playing' || !cell || cell.open) return s
  const cells = s.cells.slice()
  cells[i] = { ...cell, flag: !cell.flag }
  return { ...s, cells }
}

export function flagsLeft(s: MinesState): number {
  return s.mines - s.cells.filter((c) => c.flag).length
}
