import { describe, expect, it } from 'vitest'
import { seeded } from '@/engine/random'
import {
  completedUnits,
  conflicts,
  countSolutions,
  createState,
  generate,
  hasNote,
  hint,
  isSolved,
  LEVELS,
  setValue,
  solve,
  toggleNote,
} from './logic'

const parse = (s: string) => [...s.replace(/\s/g, '')].map((c) => (c === '.' ? 0 : Number(c)))

// A well-known puzzle with a single solution.
const PUZZLE = parse(`
53..7.... 6..195... .98....6. 8...6...3 4..8.3..1 7...2...6 .6....28. ...419..5 ....8..79`)

describe('solver', () => {
  it('solves a classic puzzle', () => {
    const s = solve(PUZZLE)!
    expect(s.slice(0, 9)).toEqual([5, 3, 4, 6, 7, 8, 9, 1, 2])
    expect(conflicts(s).size).toBe(0)
  })

  it('tells one solution from many, and none from a broken grid', () => {
    expect(countSolutions(PUZZLE)).toBe(1)
    const loose = PUZZLE.slice()
    loose.fill(0, 0, 27)
    expect(countSolutions(loose)).toBe(2)
    const broken = PUZZLE.slice()
    broken[2] = 5
    expect(countSolutions(broken)).toBe(0)
  })
})

describe('generator', () => {
  it('makes 100 puzzles, every one with exactly one solution', () => {
    const random = seeded(2026)
    const started = performance.now()
    for (let n = 0; n < 100; n++) {
      const level = LEVELS[n % LEVELS.length]!
      const { puzzle, solution } = generate(level, random)
      expect(countSolutions(puzzle)).toBe(1)
      expect(solve(puzzle)).toEqual(solution)
      expect(puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(level.clues)
      puzzle.forEach((v, i) => v && expect(v).toBe(solution[i]))
    }
    const ms = performance.now() - started
    console.info(`100 puzzles in ${ms.toFixed(0)} ms (${(ms / 100).toFixed(1)} ms each)`)
  })

  it('is repeatable with the same seed (for the daily puzzle)', () => {
    expect(generate(LEVELS[1]!, seeded(7)).puzzle).toEqual(generate(LEVELS[1]!, seeded(7)).puzzle)
  })
})

describe('play', () => {
  const start = () => createState(PUZZLE, solve(PUZZLE)!)

  it('does not change given numbers', () => {
    const s = start()
    expect(setValue(s, 0, 9)).toBe(s)
  })

  it('finds conflicts in rows, columns and boxes', () => {
    const s = setValue(start(), 2, 5)
    expect([...conflicts(s.values)].sort((a, b) => a - b)).toEqual([0, 2])
  })

  it('keeps pencil marks and clears them from peers when a number goes in', () => {
    let s = toggleNote(start(), 2, 4)
    s = toggleNote(s, 3, 4)
    expect(hasNote(s, 2, 4)).toBe(true)
    s = setValue(s, 2, 4)
    expect(hasNote(s, 3, 4)).toBe(false)
    expect(s.notes[2]).toBe(0)
  })

  it('reports completed units and the solved board', () => {
    const solution = solve(PUZZLE)!
    let s = start()
    for (let i = 0; i < 8; i++) s = setValue(s, i, solution[i]!)
    expect(completedUnits(s, 7)).toEqual([])
    s = setValue(s, 8, solution[8]!)
    expect(completedUnits(s, 8).map((u) => u.kind)).toContain('row')
    for (let i = 0; i < 81; i++) s = setValue(s, i, solution[i]!)
    expect(isSolved(s)).toBe(true)
  })

  it('hints the selected cell, or the easiest one', () => {
    const s = start()
    const h = hint(s, 2)!
    expect(h.cell).toBe(2)
    expect(h.state.values[2]).toBe(4)
    const any = hint(s, 0)!
    expect(any.state.values[any.cell]).toBe(solve(PUZZLE)![any.cell])
  })
})

describe('daily puzzle', () => {
  it('generates the same grid from the same seed', () => {
    const level = LEVELS[1]!
    expect(generate(level, seeded(2026_10_03))).toEqual(generate(level, seeded(2026_10_03)))
    expect(generate(level, seeded(1)).puzzle).not.toEqual(generate(level, seeded(2)).puzzle)
  })
})
