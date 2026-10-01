/** Memory rules, no Vue: find all pairs with as few moves as possible. */
import { shuffle, type Random } from '@/engine/random'

export interface Card {
  face: string
  matched: boolean
}

export interface MemoryState {
  cards: Card[]
  /** Cards face up but not matched yet: zero, one, or a missed pair. */
  open: number[]
  /** One move = turning two cards. */
  moves: number
}

export type FlipResult = 'ignored' | 'first' | 'match' | 'miss'

export interface Size {
  id: 'small' | 'medium' | 'large'
  label: string
  cols: number
  rows: number
}

export const SIZES: Size[] = [
  { id: 'small', label: '4 × 4', cols: 4, rows: 4 },
  { id: 'medium', label: '4 × 6', cols: 4, rows: 6 },
  { id: 'large', label: '6 × 6', cols: 6, rows: 6 },
]

export interface Deck {
  id: string
  label: string
  faces: string[]
}

export const DECKS: Deck[] = [
  {
    id: 'animals',
    label: 'Animals',
    faces: [...'🦊🐼🐸🦁🐙🦉🐢🦄🐝🐳🦔🐧🦀🐨🦩🐌🦜🐞'],
  },
  {
    id: 'food',
    label: 'Food',
    faces: [...'🍉🍓🥑🍋🍩🍕🌮🍪🥨🍒🧁🍇🥕🍔🍿🥐🍍🍑'],
  },
  {
    id: 'space',
    label: 'Space',
    faces: [
      '🚀',
      '🌙',
      '⭐',
      '🪐',
      '🛸',
      '🌍',
      '👽',
      '🔭',
      '🌞',
      '🌌',
      '💫',
      '🌠',
      '🌑',
      '🌈',
      '⚡',
      '🌋',
      '🌊',
      '🌟',
    ],
  },
]

export function deal(faces: readonly string[], pairs: number, random: Random): MemoryState {
  const picked = shuffle(faces, random).slice(0, pairs)
  const cards = shuffle([...picked, ...picked], random).map((face) => ({ face, matched: false }))
  return { cards, open: [], moves: 0 }
}

/** Turns a missed pair face down again. */
export function hideMiss(s: MemoryState): MemoryState {
  return s.open.length === 2 ? { ...s, open: [] } : s
}

export function flip(s: MemoryState, i: number): { state: MemoryState; result: FlipResult } {
  const card = s.cards[i]
  if (!card || card.matched) return { state: s, result: 'ignored' }
  // A quick third tap closes the missed pair at once instead of waiting.
  const base = hideMiss(s)
  if (base.open.includes(i)) return { state: s, result: 'ignored' }
  if (base.open.length === 0) return { state: { ...base, open: [i] }, result: 'first' }

  const j = base.open[0]!
  const moves = base.moves + 1
  if (base.cards[j]!.face === card.face) {
    const cards = base.cards.map((c, k) => (k === i || k === j ? { ...c, matched: true } : c))
    return { state: { cards, open: [], moves }, result: 'match' }
  }
  return { state: { ...base, open: [j, i], moves }, result: 'miss' }
}

export const isFaceUp = (s: MemoryState, i: number) => s.cards[i]!.matched || s.open.includes(i)

export const isWon = (s: MemoryState) => s.cards.every((c) => c.matched)

export const pairsFound = (s: MemoryState) => s.cards.filter((c) => c.matched).length / 2
