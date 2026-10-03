import { describe, expect, it } from 'vitest'
import { dailySeed, dateKey, streak } from './daily'

const data = (sudoku: string[], minesweeper: string[] = []) => ({
  sudoku: Object.fromEntries(sudoku.map((d) => [d, 100])),
  minesweeper: Object.fromEntries(minesweeper.map((d) => [d, 100])),
})

describe('daily puzzles', () => {
  it('formats the local date', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('gives every date and game its own stable seed', () => {
    expect(dailySeed('sudoku', '2026-10-03')).toBe(dailySeed('sudoku', '2026-10-03'))
    expect(dailySeed('sudoku', '2026-10-03')).not.toBe(dailySeed('sudoku', '2026-10-04'))
    expect(dailySeed('sudoku', '2026-10-03')).not.toBe(dailySeed('minesweeper', '2026-10-03'))
  })

  it('counts days in a row across both games', () => {
    expect(streak('2026-10-03', data(['2026-10-03', '2026-10-02'], ['2026-10-01']))).toBe(3)
  })

  it('keeps yesterday’s streak alive until today is over', () => {
    expect(streak('2026-10-03', data(['2026-10-02', '2026-10-01']))).toBe(2)
  })

  it('breaks on a missed day and crosses month ends', () => {
    expect(streak('2026-10-03', data(['2026-10-03', '2026-10-01']))).toBe(1)
    expect(streak('2026-10-01', data(['2026-10-01', '2026-09-30', '2026-09-29']))).toBe(3)
    expect(streak('2026-10-03', data([]))).toBe(0)
  })
})
