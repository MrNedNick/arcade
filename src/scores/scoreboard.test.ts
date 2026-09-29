import { beforeEach, describe, expect, it } from 'vitest'
import { insertEntry, LocalScoreBoard, rankOf, TOP_SIZE, type ScoreEntry } from './scoreboard'

const e = (name: string, score: number, at: number): ScoreEntry => ({ name, score, at })

describe('insertEntry', () => {
  it('sorts high scores first for score games', () => {
    const { entries, rank } = insertEntry([e('a', 10, 1), e('b', 30, 2)], e('c', 20, 3), 'desc')
    expect(entries.map((x) => x.name)).toEqual(['b', 'c', 'a'])
    expect(rank).toBe(2)
  })

  it('sorts low values first for time games', () => {
    const { entries } = insertEntry([e('a', 90, 1), e('b', 40, 2)], e('c', 60, 3), 'asc')
    expect(entries.map((x) => x.name)).toEqual(['b', 'c', 'a'])
  })

  it('keeps only the top ten', () => {
    const full = Array.from({ length: TOP_SIZE }, (_, i) => e(`p${i}`, 100 - i, i))
    const low = insertEntry(full, e('late', 1, 99), 'desc')
    expect(low.rank).toBeNull()
    expect(low.entries).toHaveLength(TOP_SIZE)
    const high = insertEntry(full, e('champ', 500, 99), 'desc')
    expect(high.rank).toBe(1)
    expect(high.entries).toHaveLength(TOP_SIZE)
    expect(high.entries.at(-1)?.name).toBe('p8')
  })

  it('breaks ties by time: who got there first stays ahead', () => {
    const { entries, rank } = insertEntry([e('first', 50, 10)], e('second', 50, 20), 'desc')
    expect(entries.map((x) => x.name)).toEqual(['first', 'second'])
    expect(rank).toBe(2)
  })
})

describe('rankOf', () => {
  it('predicts the rank without changing the board', () => {
    const board = [e('a', 30, 1), e('b', 10, 2)]
    expect(rankOf(board, 20, 'desc')).toBe(2)
    expect(rankOf(board, 30, 'desc')).toBe(2)
    expect(board).toHaveLength(2)
  })
})

describe('LocalScoreBoard', () => {
  beforeEach(() => localStorage.clear())

  it('persists entries and survives a new instance (a reload)', async () => {
    const board = new LocalScoreBoard(() => 'desc')
    await board.submit('snake', e('Ann', 12, 1))
    await board.submit('snake', e('Bob', 40, 2))
    const again = new LocalScoreBoard(() => 'desc')
    expect((await again.top('snake')).map((x) => x.name)).toEqual(['Bob', 'Ann'])
    expect(await again.top('tetris')).toEqual([])
  })

  it('ignores broken stored data', async () => {
    localStorage.setItem('arcade:top:snake', '{"oops":1}')
    const board = new LocalScoreBoard(() => 'desc')
    expect(await board.top('snake')).toEqual([])
    localStorage.setItem('arcade:top:snake', JSON.stringify([{ name: 'x' }, e('ok', 3, 1)]))
    expect((await board.top('snake')).map((x) => x.name)).toEqual(['ok'])
  })
})
