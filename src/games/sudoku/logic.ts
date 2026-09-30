/** Sudoku rules, generator and solver, no Vue. A grid is 81 numbers, 0 = empty. */
import { shuffle, type Random } from '@/engine/random'

export type Grid = number[]

export interface Level {
  id: 'easy' | 'medium' | 'hard'
  label: string
  /** Givens left on the board. Fewer clues, harder puzzle. */
  clues: number
}

export const LEVELS: Level[] = [
  { id: 'easy', label: 'Easy', clues: 40 },
  { id: 'medium', label: 'Medium', clues: 32 },
  { id: 'hard', label: 'Hard', clues: 26 },
]

export const rowOf = (i: number) => Math.floor(i / 9)
export const colOf = (i: number) => i % 9
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3)

/** The 20 cells that share a row, column or box with cell i. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter(
    (j) => j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i)),
  ),
)

export const UNITS: { kind: 'row' | 'col' | 'box'; cells: number[] }[] = [
  ...Array.from({ length: 9 }, (_, r) => ({
    kind: 'row' as const,
    cells: Array.from({ length: 9 }, (_, c) => r * 9 + c),
  })),
  ...Array.from({ length: 9 }, (_, c) => ({
    kind: 'col' as const,
    cells: Array.from({ length: 9 }, (_, r) => r * 9 + c),
  })),
  ...Array.from({ length: 9 }, (_, b) => ({
    kind: 'box' as const,
    cells: Array.from(
      { length: 9 },
      (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3),
    ),
  })),
]

const ALL = 0b1111111110 // bits 1..9
const bit = (v: number) => 1 << v
const popcount = (m: number) => {
  let n = 0
  while (m) {
    m &= m - 1
    n++
  }
  return n
}

/**
 * Counts solutions up to `limit`, filling `out` with the first one found.
 * Bitmask candidates plus "fewest options first" keep it fast.
 */
export function countSolutions(grid: Grid, limit = 2, out?: Grid, random?: Random): number {
  const g = grid.slice()
  const rows = new Array(9).fill(0)
  const cols = new Array(9).fill(0)
  const boxes = new Array(9).fill(0)
  for (let i = 0; i < 81; i++) {
    const v = g[i]!
    if (!v) continue
    const b = bit(v)
    if (rows[rowOf(i)] & b || cols[colOf(i)] & b || boxes[boxOf(i)] & b) return 0
    rows[rowOf(i)] |= b
    cols[colOf(i)] |= b
    boxes[boxOf(i)] |= b
  }
  let found = 0
  function search(): boolean {
    let best = -1
    let bestMask = 0
    let bestCount = 10
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue
      const mask = ALL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)])
      const n = popcount(mask)
      if (n === 0) return false
      if (n < bestCount) {
        best = i
        bestMask = mask
        bestCount = n
        if (n === 1) break
      }
    }
    if (best === -1) {
      if (found === 0 && out) out.splice(0, 81, ...g)
      found++
      return found >= limit
    }
    let digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => bestMask & bit(d))
    if (random) digits = shuffle(digits, random)
    const r = rowOf(best)
    const c = colOf(best)
    const bx = boxOf(best)
    for (const d of digits) {
      const b = bit(d)
      g[best] = d
      rows[r] |= b
      cols[c] |= b
      boxes[bx] |= b
      if (search()) return true
      rows[r] &= ~b
      cols[c] &= ~b
      boxes[bx] &= ~b
    }
    g[best] = 0
    return false
  }
  search()
  return found
}

export function solve(grid: Grid): Grid | null {
  const out: Grid = []
  return countSolutions(grid, 1, out) ? out : null
}

/**
 * A puzzle with exactly one solution: fill a random full grid, then take numbers
 * away in random order while the answer stays unique.
 */
export function generate(level: Level, random: Random): { puzzle: Grid; solution: Grid } {
  const solution: Grid = []
  countSolutions(new Array(81).fill(0), 1, solution, random)
  const puzzle = solution.slice()
  let clues = 81
  for (const i of shuffle(
    Array.from({ length: 81 }, (_, k) => k),
    random,
  )) {
    if (clues <= level.clues) break
    const keep = puzzle[i]!
    puzzle[i] = 0
    if (countSolutions(puzzle, 2) !== 1) puzzle[i] = keep
    else clues--
  }
  return { puzzle, solution }
}

// ── Play state ──────────────────────────────────────────────────────

export interface SudokuState {
  puzzle: Grid
  solution: Grid
  values: Grid
  /** Pencil marks per cell as a bitmask of digits 1..9. */
  notes: number[]
}

export function createState(puzzle: Grid, solution: Grid): SudokuState {
  return { puzzle, solution, values: puzzle.slice(), notes: new Array(81).fill(0) }
}

export const isGiven = (s: SudokuState, i: number) => s.puzzle[i] !== 0

/** Places (or clears with 0) a number; the same number leaves peers' pencil marks. */
export function setValue(s: SudokuState, i: number, v: number): SudokuState {
  if (isGiven(s, i) || s.values[i] === v) return s
  const values = s.values.slice()
  values[i] = v
  const notes = s.notes.slice()
  notes[i] = 0
  if (v) for (const p of PEERS[i]!) notes[p]! &= ~bit(v)
  return { ...s, values, notes }
}

export function toggleNote(s: SudokuState, i: number, v: number): SudokuState {
  if (isGiven(s, i) || s.values[i]) return s
  const notes = s.notes.slice()
  notes[i]! ^= bit(v)
  return { ...s, notes }
}

export const hasNote = (s: SudokuState, i: number, v: number) => (s.notes[i]! & bit(v)) !== 0

/** Cells whose number clashes with the same number in a row, column or box. */
export function conflicts(values: Grid): Set<number> {
  const out = new Set<number>()
  for (let i = 0; i < 81; i++) {
    const v = values[i]
    if (v && PEERS[i]!.some((p) => values[p] === v)) out.add(i)
  }
  return out
}

export function isSolved(s: SudokuState): boolean {
  return s.values.every((v, i) => v === s.solution[i])
}

/** Rows, columns and boxes through cell i that are now full and correct. */
export function completedUnits(s: SudokuState, i: number) {
  return UNITS.filter(
    (u) => u.cells.includes(i) && u.cells.every((c) => s.values[c] === s.solution[c]),
  )
}

/**
 * Reveals one right number: the selected cell if it is empty or wrong,
 * otherwise the empty cell with the fewest options.
 */
export function hint(
  s: SudokuState,
  selected: number | null,
): { state: SudokuState; cell: number } | null {
  const wrongOrEmpty = (i: number) => !isGiven(s, i) && s.values[i] !== s.solution[i]
  let cell = selected !== null && wrongOrEmpty(selected) ? selected : -1
  if (cell === -1) {
    let bestCount = 10
    for (let i = 0; i < 81; i++) {
      if (!wrongOrEmpty(i)) continue
      const used = new Set(PEERS[i]!.map((p) => s.values[p]))
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !used.has(d)).length
      if (options < bestCount) {
        bestCount = options
        cell = i
      }
    }
  }
  if (cell === -1) return null
  return { state: setValue(s, cell, s.solution[cell]!), cell }
}
