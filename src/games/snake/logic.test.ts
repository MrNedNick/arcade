import { describe, expect, it } from 'vitest'
import { createGame, spawnFood, step, stepMs, turn, type SnakeState } from './logic'

const fixed = () => 0

function game(partial: Partial<SnakeState> = {}): SnakeState {
  return { ...createGame({ cols: 10, rows: 10 }, fixed), ...partial }
}

describe('snake rules', () => {
  it('moves one cell in the current direction', () => {
    const s = game({
      body: [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
      food: { x: 9, y: 9 },
    })
    const { state } = step(s)
    expect(state.body).toEqual([
      { x: 4, y: 3 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
    ])
  })

  it('grows by one and scores when it eats', () => {
    const s = game({
      body: [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
      food: { x: 4, y: 3 },
    })
    const { state, events } = step(s, fixed)
    expect(events).toEqual(['eat'])
    expect(state.body).toHaveLength(4)
    expect(state.score).toBe(1)
    expect(state.body).not.toContainEqual(state.food)
  })

  it('refuses a 180° turn, even two quick presses that would add up to one', () => {
    const s = game({ dir: 'right' })
    expect(turn(s, 'left').queue).toEqual([])
    // up then left is a legal L-turn, but right-then-left in one tick is not
    const queued = turn(turn(s, 'up'), 'left')
    expect(queued.queue).toEqual(['up', 'left'])
    expect(turn(turn(s, 'up'), 'down').queue).toEqual(['up'])
  })

  it('keeps quick turns so none are lost between moves', () => {
    const s = turn(
      turn(
        game({
          body: [
            { x: 5, y: 5 },
            { x: 4, y: 5 },
            { x: 3, y: 5 },
          ],
          food: { x: 0, y: 0 },
        }),
        'down',
      ),
      'left',
    )
    const first = step(s).state
    expect(first.dir).toBe('down')
    const second = step(first).state
    expect(second.dir).toBe('left')
    expect(second.body[0]).toEqual({ x: 4, y: 6 })
  })

  it('dies on a wall in classic mode and passes through in wrap mode', () => {
    const edge = {
      body: [
        { x: 9, y: 2 },
        { x: 8, y: 2 },
        { x: 7, y: 2 },
      ],
      food: { x: 0, y: 9 },
    }
    const hit = step(game({ ...edge, wrap: false }))
    expect(hit.events).toEqual(['die'])
    expect(hit.state.alive).toBe(false)
    const through = step(game({ ...edge, wrap: true }))
    expect(through.events).toEqual([])
    expect(through.state.body[0]).toEqual({ x: 0, y: 2 })
  })

  it('dies when it bites itself', () => {
    // A hook: head at (2,2) moving down into its own body at (2,3).
    const s = game({
      dir: 'down',
      body: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
      ],
      food: { x: 9, y: 9 },
    })
    expect(step(s).events).toEqual(['die'])
  })

  it('may follow its own tail, because the tail moves away', () => {
    const s = game({
      dir: 'down',
      body: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 2, y: 3 },
      ],
      food: { x: 9, y: 9 },
    })
    expect(step(s).state.alive).toBe(true)
  })

  it('never spawns food on the snake', () => {
    const body = Array.from({ length: 99 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) }))
    expect(spawnFood({ cols: 10, rows: 10, body }, () => 0.5)).toEqual({ x: 9, y: 9 })
  })

  it('speeds up with the score but not beyond the limit', () => {
    expect(stepMs(10)).toBeLessThan(stepMs(0))
    expect(stepMs(500)).toBe(62)
  })
})
