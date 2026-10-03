import { useSettings } from '@/composables/useSettings'

/**
 * Tiny synthesized sound effects and matching vibration — no audio files.
 * Nothing starts before the player has pressed a key or touched the screen:
 * browsers block audio and vibration until then, and the AudioContext is
 * created lazily on the first sound after that.
 */
export type Sound =
  | 'start'
  | 'tap'
  | 'move'
  | 'rotate'
  | 'hold'
  | 'lock'
  | 'drop'
  | 'eat'
  | 'line'
  | 'tetris'
  | 'level'
  | 'reveal'
  | 'cascade'
  | 'flag'
  | 'unflag'
  | 'flip'
  | 'match'
  | 'miss'
  | 'crash'
  | 'win'
  | 'record'

/** Vibration pattern per sound; sounds without one stay silent in the hand. */
const HAPTICS: Partial<Record<Sound, number | number[]>> = {
  drop: 10,
  eat: 8,
  line: 12,
  tetris: [20, 30, 40],
  flag: 10,
  unflag: 6,
  match: 12,
  miss: 20,
  crash: [30, 40, 60],
  win: [15, 30, 15],
}

/** Overall loudness: quiet by default, these are accents, not a soundtrack. */
const VOLUME = 0.55

let ctx: AudioContext | null = null
let master: GainNode | null = null

/** False until the page has had a real key press, click or tap. */
export function hasUserGesture(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation
  return activation ? activation.hasBeenActive : true
}

function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined' || !hasUserGesture()) return null
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = VOLUME
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  a: AudioContext,
  freq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
) {
  const t = a.currentTime + delay
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(g).connect(master!)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

/** A short burst of filtered noise — thuds and explosions. */
function noise(a: AudioContext, duration: number, cutoff: number, gain: number, delay = 0) {
  const t = a.currentTime + delay
  const length = Math.ceil(a.sampleRate * duration)
  const buffer = a.createBuffer(1, length, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(cutoff, t)
  filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff / 6), t + duration)
  const g = a.createGain()
  g.gain.value = gain
  src.connect(filter).connect(g).connect(master!)
  src.start(t)
}

const arpeggio = (a: AudioContext, notes: number[], step: number, length: number, gain: number) =>
  notes.forEach((f, i) => tone(a, f, f, length, 'triangle', gain, i * step))

function synth(a: AudioContext, sound: Sound) {
  switch (sound) {
    case 'start':
      return arpeggio(a, [392, 587], 0.06, 0.09, 0.05)
    case 'tap':
      return tone(a, 520, 480, 0.05, 'triangle', 0.04)
    case 'move':
      return tone(a, 300, 280, 0.03, 'square', 0.012)
    case 'rotate':
      return tone(a, 420, 620, 0.05, 'triangle', 0.03)
    case 'hold':
      return tone(a, 700, 350, 0.08, 'triangle', 0.035)
    case 'lock':
      return tone(a, 180, 120, 0.06, 'triangle', 0.05)
    case 'drop':
      noise(a, 0.12, 900, 0.18)
      return tone(a, 150, 60, 0.12, 'sine', 0.09)
    case 'eat':
      return tone(a, 660, 990, 0.09, 'triangle', 0.06)
    case 'line':
      return arpeggio(a, [523, 784], 0.05, 0.1, 0.055)
    case 'tetris':
      return arpeggio(a, [523, 659, 784, 1047, 1319], 0.06, 0.16, 0.06)
    case 'level':
      return arpeggio(a, [440, 554, 659, 880], 0.07, 0.12, 0.05)
    case 'reveal':
      return tone(a, 880, 760, 0.04, 'sine', 0.035)
    case 'cascade':
      return [0, 0.04, 0.08].forEach((d, i) =>
        tone(a, 700 + i * 140, 600 + i * 140, 0.06, 'sine', 0.03, d),
      )
    case 'flag':
      return tone(a, 520, 880, 0.07, 'square', 0.02)
    case 'unflag':
      return tone(a, 760, 420, 0.06, 'square', 0.015)
    case 'flip':
      noise(a, 0.05, 3200, 0.05)
      return tone(a, 600, 900, 0.05, 'sine', 0.02)
    case 'match':
      return arpeggio(a, [784, 1175], 0.07, 0.12, 0.05)
    case 'miss':
      return tone(a, 260, 200, 0.14, 'triangle', 0.045)
    case 'crash':
      noise(a, 0.45, 1400, 0.2)
      return tone(a, 220, 55, 0.35, 'sawtooth', 0.04)
    case 'win':
      return arpeggio(a, [523, 659, 784, 1047], 0.09, 0.18, 0.06)
    case 'record':
      arpeggio(a, [523, 659, 784, 1047], 0.09, 0.14, 0.06)
      return tone(a, 1568, 1568, 0.4, 'sine', 0.04, 0.36)
  }
}

/** Vibrates when the device can, the player allows it, and the page has been touched. */
export function buzz(pattern: number | number[]): void {
  if (!useSettings().haptics || !hasUserGesture()) return
  if (typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* some browsers throw instead of ignoring */
  }
}

/** Plays a sound and its matching vibration, each only if switched on. */
export function play(sound: Sound): void {
  const pattern = HAPTICS[sound]
  if (pattern !== undefined) buzz(pattern)
  if (!useSettings().sound) return
  const a = audio()
  if (a) synth(a, sound)
}

export const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
