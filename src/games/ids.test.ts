import { describe, expect, it } from 'vitest'
import { GAME_IDS, isGameId } from './ids'

describe('game ids', () => {
  it('knows every game that gets its own address', () => {
    expect(GAME_IDS).toEqual(['snake', 'tetris', 'minesweeper', 'sudoku', 'memory'])
  })

  it('rejects anything else', () => {
    expect(isGameId('snake')).toBe(true)
    expect(isGameId('pong')).toBe(false)
    expect(isGameId(undefined)).toBe(false)
  })
})
