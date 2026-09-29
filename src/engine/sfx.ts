import { useSettings } from '@/composables/useSettings'

/**
 * Tiny synthesized sound effects — no audio files. The AudioContext is created on
 * the first sound, which always follows a key press or a tap, so autoplay rules hold.
 */
export type Sound = 'tap' | 'eat' | 'crash' | 'record'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
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
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(g).connect(a.destination)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

export function play(sound: Sound): void {
  if (!useSettings().sound) return
  const a = audio()
  if (!a) return
  switch (sound) {
    case 'tap':
      tone(a, 520, 480, 0.05, 'triangle', 0.04)
      break
    case 'eat':
      tone(a, 660, 990, 0.09, 'triangle', 0.06)
      break
    case 'crash':
      tone(a, 220, 55, 0.35, 'sawtooth', 0.05)
      break
    case 'record':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(a, f, f, 0.14, 'triangle', 0.06, i * 0.09))
      break
  }
}
