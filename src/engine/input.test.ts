import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindInput, keyToAction, swipeDirection, type Action } from './input'

describe('keyToAction', () => {
  it('maps arrows and WASD to directions', () => {
    expect(keyToAction('ArrowUp')).toBe('up')
    expect(keyToAction('a')).toBe('left')
    expect(keyToAction('D')).toBe('right')
  })

  it('maps space, pause and restart keys', () => {
    expect(keyToAction(' ')).toBe('primary')
    expect(keyToAction('Escape')).toBe('pause')
    expect(keyToAction('P')).toBe('pause')
    expect(keyToAction('r')).toBe('restart')
  })

  it('ignores unrelated keys', () => {
    expect(keyToAction('q')).toBeNull()
    expect(keyToAction('F5')).toBeNull()
  })
})

describe('swipeDirection', () => {
  it('treats short movements as taps', () => {
    expect(swipeDirection(5, -10)).toBeNull()
  })

  it('picks the dominant axis', () => {
    expect(swipeDirection(60, 20)).toBe('right')
    expect(swipeDirection(-60, 20)).toBe('left')
    expect(swipeDirection(10, 40)).toBe('down')
    expect(swipeDirection(-30, -50)).toBe('up')
  })
})

describe('bindInput', () => {
  let dispose: (() => void) | undefined
  afterEach(() => dispose?.())

  it('forwards keyboard actions and skips typing in fields', () => {
    const seen: Action[] = []
    dispose = bindInput({ onAction: (a) => seen.push(a) })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    const input = document.createElement('input')
    document.body.append(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(seen).toEqual(['left'])
    input.remove()
  })

  it('turns a drag on the surface into a swipe and a still touch into a tap', () => {
    const onAction = vi.fn()
    const surface = document.createElement('div')
    dispose = bindInput({ surface, onAction })
    const fire = (type: string, x: number, y: number) =>
      surface.dispatchEvent(
        new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch' }),
      )
    fire('pointerdown', 100, 100)
    fire('pointermove', 100, 150)
    fire('pointerup', 100, 150)
    expect(onAction).toHaveBeenLastCalledWith('down')
    fire('pointerdown', 10, 10)
    fire('pointerup', 12, 11)
    expect(onAction).toHaveBeenLastCalledWith('tap')
  })
})
