import { describe, expect, it } from 'vitest'
import { seeded } from '@/engine/random'
import {
  DECKS,
  deal,
  flip,
  hideMiss,
  isFaceUp,
  isWon,
  pairsFound,
  SIZES,
  type MemoryState,
} from './logic'

const faces = DECKS[0]!.faces

function pairOf(s: MemoryState, i: number) {
  return s.cards.findIndex((c, k) => k !== i && c.face === s.cards[i]!.face)
}

describe('deal', () => {
  it('puts every chosen face on the table exactly twice', () => {
    for (const size of SIZES) {
      const pairs = (size.cols * size.rows) / 2
      const s = deal(faces, pairs, seeded(size.cols * 10 + size.rows))
      expect(s.cards).toHaveLength(pairs * 2)
      const counts = new Map<string, number>()
      for (const c of s.cards) counts.set(c.face, (counts.get(c.face) ?? 0) + 1)
      expect(counts.size).toBe(pairs)
      expect([...counts.values()].every((n) => n === 2)).toBe(true)
    }
  })

  it('shuffles differently for different seeds and the same for the same seed', () => {
    const a = deal(faces, 8, seeded(1)).cards.map((c) => c.face)
    const b = deal(faces, 8, seeded(2)).cards.map((c) => c.face)
    expect(a).not.toEqual(b)
    expect(deal(faces, 8, seeded(1)).cards.map((c) => c.face)).toEqual(a)
  })

  it('has enough faces in every deck for the largest board', () => {
    const most = Math.max(...SIZES.map((s) => (s.cols * s.rows) / 2))
    for (const d of DECKS) {
      expect(new Set(d.faces).size).toBe(d.faces.length)
      expect(d.faces.length).toBeGreaterThanOrEqual(most)
    }
  })
})

describe('turning cards', () => {
  const start = () => deal(faces, 8, seeded(5))

  it('matches a pair and counts one move', () => {
    const s0 = start()
    const j = pairOf(s0, 0)
    const s1 = flip(s0, 0)
    expect(s1.result).toBe('first')
    const s2 = flip(s1.state, j)
    expect(s2.result).toBe('match')
    expect(s2.state.moves).toBe(1)
    expect(pairsFound(s2.state)).toBe(1)
    expect(isFaceUp(s2.state, 0) && isFaceUp(s2.state, j)).toBe(true)
  })

  it('leaves a miss face up until it is hidden or a third card is turned', () => {
    const s0 = start()
    const other = s0.cards.findIndex((c) => c.face !== s0.cards[0]!.face)
    const miss = flip(flip(s0, 0).state, other)
    expect(miss.result).toBe('miss')
    expect(miss.state.open).toEqual([0, other])
    expect(hideMiss(miss.state).open).toEqual([])
    const third = s0.cards.findIndex((_, k) => k !== 0 && k !== other)
    const next = flip(miss.state, third)
    expect(next.result).toBe('first')
    expect(next.state.open).toEqual([third])
  })

  it('ignores the same card twice and cards already matched', () => {
    const s0 = start()
    const s1 = flip(s0, 0).state
    expect(flip(s1, 0).result).toBe('ignored')
    const done = flip(s1, pairOf(s0, 0)).state
    expect(flip(done, 0).result).toBe('ignored')
  })

  it('wins when every pair is found', () => {
    let s = start()
    const seen = new Set<number>()
    for (let i = 0; i < s.cards.length; i++) {
      if (seen.has(i)) continue
      const j = pairOf(s, i)
      seen.add(i).add(j)
      s = flip(flip(s, i).state, j).state
    }
    expect(isWon(s)).toBe(true)
    expect(s.moves).toBe(8)
  })
})
