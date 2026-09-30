import { describe, expect, it } from 'vitest'
import {
  bag,
  COLS,
  createGame,
  emptyBoard,
  fits,
  ghostY,
  hardDrop,
  hold,
  LOCK_DELAY_MS,
  move,
  pieceCells,
  ROWS,
  rotate,
  tick,
  TYPES,
  type Board,
  type Piece,
  type PieceType,
  type TetrisState,
} from './logic'

function seeded(seed = 1) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function withPiece(piece: Piece, board: Board = emptyBoard(), queue: PieceType[] = [...TYPES]) {
  return { ...createGame(seeded()), active: piece, board, queue }
}

function fillRow(board: Board, y: number, except: number[] = []) {
  for (let x = 0; x < COLS; x++) if (!except.includes(x)) board[y]![x] = 'Z'
}

describe('7-bag randomizer', () => {
  it('deals every piece exactly once per bag', () => {
    const random = seeded(7)
    for (let i = 0; i < 20; i++) expect([...bag(random)].sort()).toEqual([...TYPES].sort())
  })

  it('keeps the preview queue topped up', () => {
    let s: TetrisState = createGame(seeded(3))
    for (let i = 0; i < 30; i++) {
      s = hardDrop(s, seeded(i)).state
      if (s.over) break
      expect(s.queue.length).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('SRS rotation', () => {
  it('rotates a T in open space without moving it', () => {
    const s = withPiece({ type: 'T', rot: 0, x: 4, y: 10 })
    const r = rotate(s, 1)
    expect(r.active).toMatchObject({ rot: 1, x: 4, y: 10 })
    expect(rotate(r, -1).active).toMatchObject({ rot: 0, x: 4, y: 10 })
  })

  it('kicks a T off the left wall instead of refusing to turn', () => {
    // Vertical T (state R) hugging the left wall; turning flat needs a kick to the right.
    const s = withPiece({ type: 'T', rot: 1, x: -1, y: 10 })
    expect(fits(s.board, s.active)).toBe(true)
    expect(fits(s.board, { ...s.active, rot: 2 })).toBe(false)
    const r = rotate(s, 1)
    expect(r.active.rot).toBe(2)
    expect(r.active.x).toBe(0)
    expect(pieceCells(r.active).every(([x]) => x >= 0)).toBe(true)
  })

  it('kicks an I piece at the right wall', () => {
    const s = withPiece({ type: 'I', rot: 1, x: 7, y: 10 })
    expect(pieceCells(s.active).map(([x]) => x)).toEqual([9, 9, 9, 9])
    const r = rotate(s, 1)
    expect(r.active.rot).toBe(2)
    expect(pieceCells(r.active).every(([x]) => x >= 0 && x < COLS)).toBe(true)
  })

  it('never rotates into other blocks', () => {
    const board = emptyBoard()
    for (let y = 0; y < ROWS; y++) {
      board[y]![3] = 'Z'
      board[y]![5] = 'Z'
    }
    const s = withPiece({ type: 'I', rot: 1, x: 2, y: 10 }, board)
    expect(rotate(s, 1)).toBe(s)
  })

  it('does not rotate the O piece', () => {
    const s = withPiece({ type: 'O', rot: 0, x: 4, y: 10 })
    expect(rotate(s, 1)).toBe(s)
  })
})

describe('movement and dropping', () => {
  it('stops at walls', () => {
    let s: TetrisState = withPiece({ type: 'O', rot: 0, x: 4, y: 10 })
    for (let i = 0; i < 10; i++) s = move(s, -1)
    expect(s.active.x).toBe(0)
  })

  it('shows the ghost where a hard drop would land', () => {
    const s = withPiece({ type: 'O', rot: 0, x: 4, y: 2 })
    expect(ghostY(s)).toBe(ROWS - 2)
    const { state, events } = hardDrop(s, seeded())
    expect(events[0]).toMatchObject({ type: 'hardDrop', distance: ROWS - 4 })
    expect(state.board[ROWS - 1]![4]).toBe('O')
    expect(state.score).toBe((ROWS - 4) * 2)
  })

  it('locks only after the lock delay once grounded', () => {
    const s = withPiece({ type: 'O', rot: 0, x: 4, y: ROWS - 2 })
    const early = tick(s, LOCK_DELAY_MS - 10)
    expect(early.events).toEqual([])
    const late = tick(early.state, 20)
    expect(late.events[0]).toMatchObject({ type: 'lock' })
  })
})

describe('line clears and scoring', () => {
  it('clears several lines at once and scores by the table', () => {
    const board = emptyBoard()
    for (const y of [ROWS - 1, ROWS - 2, ROWS - 3, ROWS - 4]) fillRow(board, y, [9])
    board[ROWS - 5]![0] = 'L'
    const s = withPiece({ type: 'I', rot: 1, x: 7, y: 5 }, board)
    const { state, events } = hardDrop(s, seeded())
    const clear = events.find((e) => e.type === 'clear')
    expect(clear).toMatchObject({ rows: [ROWS - 4, ROWS - 3, ROWS - 2, ROWS - 1] })
    expect(state.lines).toBe(4)
    expect(state.score).toBe(800 + (ROWS - 4 - 5) * 2)
    // The block above the cleared lines fell down by four.
    expect(state.board[ROWS - 1]![0]).toBe('L')
  })

  it('clears non-adjacent lines and keeps the rows between', () => {
    const board = emptyBoard()
    fillRow(board, ROWS - 1, [4])
    fillRow(board, ROWS - 2, [0, 4])
    fillRow(board, ROWS - 3, [4])
    const s = withPiece({ type: 'I', rot: 1, x: 2, y: 5 }, board)
    const { state } = hardDrop(s, seeded())
    expect(state.lines).toBe(2)
    expect(state.board[ROWS - 1]!.filter(Boolean)).toHaveLength(9)
    expect(state.board[ROWS - 1]![0]).toBeNull()
  })

  it('levels up every ten lines', () => {
    const board = emptyBoard()
    fillRow(board, ROWS - 1, [9])
    const s = { ...withPiece({ type: 'I', rot: 1, x: 7, y: 5 }, board), lines: 9 }
    const { state, events } = hardDrop(s, seeded())
    expect(state.level).toBe(2)
    expect(events.some((e) => e.type === 'levelUp')).toBe(true)
  })
})

describe('hold', () => {
  it('swaps once per piece', () => {
    const s = withPiece({ type: 'T', rot: 0, x: 3, y: 1 }, emptyBoard(), ['S', 'Z', 'J', 'L', 'O'])
    const h1 = hold(s, seeded())
    expect(h1.hold).toBe('T')
    expect(h1.active.type).toBe('S')
    expect(hold(h1, seeded())).toBe(h1)
    const dropped = hardDrop(h1, seeded()).state
    const h2 = hold(dropped, seeded())
    expect(h2.active.type).toBe('T')
    expect(h2.hold).toBe('Z')
  })
})

describe('game over', () => {
  it('ends when the next piece has no room to appear', () => {
    const board = emptyBoard()
    for (let y = 2; y < ROWS; y++) fillRow(board, y, [y % COLS])
    const s = withPiece({ type: 'O', rot: 0, x: 0, y: 0 }, board)
    const { state, events } = hardDrop(s, seeded())
    expect(state.over).toBe(true)
    expect(events.at(-1)).toEqual({ type: 'gameOver' })
  })
})
