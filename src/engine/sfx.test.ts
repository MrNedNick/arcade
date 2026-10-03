import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '@/composables/useSettings'
import { buzz, play } from './sfx'

const created = vi.fn()

class FakeContext {
  state = 'running'
  currentTime = 0
  sampleRate = 8000
  destination = {}
  constructor() {
    created()
  }
  resume() {
    return Promise.resolve()
  }
  createGain() {
    return {
      gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect: (n: unknown) => n,
    }
  }
  createOscillator() {
    return {
      type: '',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect: (n: unknown) => n,
      start() {},
      stop() {},
    }
  }
  createBuffer(_c: number, length: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    return { buffer: null, connect: (n: unknown) => n, start() {} }
  }
  createBiquadFilter() {
    return {
      type: '',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect: (n: unknown) => n,
    }
  }
}

let active = false
const vibrate = vi.fn()

beforeEach(() => {
  active = false
  created.mockClear()
  vibrate.mockClear()
  vi.stubGlobal('AudioContext', FakeContext)
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    get: () => ({ hasBeenActive: active }),
  })
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
  const s = useSettings()
  s.sound = true
  s.haptics = true
})
afterEach(() => vi.unstubAllGlobals())

describe('sound and vibration', () => {
  it('stays silent until the page has been touched (autoplay rules)', () => {
    play('crash')
    expect(created).not.toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('plays and vibrates after a gesture', () => {
    active = true
    play('crash')
    expect(created).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith([30, 40, 60])
  })

  it('reuses one audio context', () => {
    active = true
    play('tap')
    play('eat')
    play('record')
    expect(created).toHaveBeenCalledTimes(0) // created in the previous test already
  })

  it('respects the sound switch without touching vibration', () => {
    active = true
    useSettings().sound = false
    play('eat')
    expect(vibrate).toHaveBeenCalledWith(8)
  })

  it('respects the vibration switch', () => {
    active = true
    useSettings().haptics = false
    play('crash')
    buzz(20)
    expect(vibrate).not.toHaveBeenCalled()
  })
})
