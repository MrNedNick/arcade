import { describe, expect, it } from 'vitest'
import {
  chord,
  createGame,
  flagsLeft,
  LEVELS,
  layMines,
  neighbours,
  reveal,
  toggleFlag,
  type MinesState,
} from './logic'

function seeded(seed = 1) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** Builds a board from a picture: '*' is a mine, '.' is empty. */
function board(picture: string[]): MinesState {
  const rows = picture.length
  const cols = picture[0]!.length
  const s = createGame(rows, cols, 0)
  const cells = s.cells.map((c, i) => ({
    ...c,
    mine: picture[Math.floor(i / cols)]![i % cols] === '*',
  }))
  for (let i = 0; i < cells.length; i++)
    cells[i]!.adj = neighbours(s, i).filter((n) => cells[n]!.mine).length
  return { ...s, cells, mines: cells.filter((c) => c.mine).length, laid: true }
}

describe('first click', () => {
  it('is always safe and opens an area, on every level, whatever the seed', () => {
    for (const level of LEVELS)
      for (let seed = 1; seed <= 40; seed++) {
        const s = createGame(level.rows, level.cols, level.mines)
        const first = Math.floor(seeded(seed)() * s.cells.length)
        const { state, opened } = reveal(s, first, seeded(seed))
        expect(state.outcome).not.toBe('lost')
        expect(state.cells.filter((c) => c.mine)).toHaveLength(level.mines)
        expect(state.cells[first]!.adj).toBe(0)
        expect(opened.length).toBeGreaterThan(1)
      }
  })

  it('still works when the board is almost all mines', () => {
    const s = createGame(3, 3, 8)
    const { state } = reveal(s, 4, seeded())
    expect(state.cells[4]!.mine).toBe(false)
    expect(state.outcome).toBe('won')
  })
})

describe('revealing', () => {
  it('floods an empty area and stops at numbers, reporting the wave order', () => {
    const s = board(['....', '....', '...*', '....'])
    const { state, opened } = reveal(s, 0)
    // The corner behind the mine is walled off by numbers, so it stays closed.
    expect(state.cells.filter((c) => c.open)).toHaveLength(14)
    expect(state.cells[15]!.open).toBe(false)
    expect(opened[0]).toEqual({ index: 0, distance: 0 })
    const far = opened.find((o) => o.index === 10)!
    expect(far.distance).toBeGreaterThan(1)
    expect(state.outcome).toBe('playing')
    expect(reveal(state, 15).state.outcome).toBe('won')
  })

  it('loses on a mine and remembers which one exploded', () => {
    const s = board(['*.', '..'])
    const { state } = reveal(s, 0)
    expect(state.outcome).toBe('lost')
    expect(state.exploded).toBe(0)
  })

  it('does not open flagged cells', () => {
    const s = toggleFlag(board(['*.', '..']), 0)
    expect(reveal(s, 0).state.outcome).toBe('playing')
    expect(flagsLeft(s)).toBe(0)
  })
})

describe('chord', () => {
  it('opens the other neighbours when the flags match the number', () => {
    let s = board(['*..', '...', '...'])
    s = reveal(s, 4).state
    expect(s.cells[4]!.adj).toBe(1)
    expect(chord(s, 4).opened).toEqual([])
    s = toggleFlag(s, 0)
    const { state } = chord(s, 4)
    expect(state.cells.filter((c) => c.open)).toHaveLength(8)
    expect(state.outcome).toBe('won')
  })

  it('loses when a flag is wrong', () => {
    let s = board(['*..', '...', '...'])
    s = reveal(s, 4).state
    s = toggleFlag(s, 1)
    expect(chord(s, 4).state.outcome).toBe('lost')
  })

  it('clicking an open number chords', () => {
    let s = board(['*..', '...', '...'])
    s = toggleFlag(reveal(s, 4).state, 0)
    expect(reveal(s, 4).state.outcome).toBe('won')
  })
})

describe('mine layout', () => {
  it('computes neighbour counts', () => {
    const s = layMines(createGame(9, 9, 10), 40, seeded(3))
    for (let i = 0; i < s.cells.length; i++)
      expect(s.cells[i]!.adj).toBe(neighbours(s, i).filter((n) => s.cells[n]!.mine).length)
  })
})
