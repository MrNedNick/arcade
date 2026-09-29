import { cssVar, prefersReducedMotion } from './motion'

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  angle: number
  spin: number
  color: string
  round: boolean
}

/** A light confetti burst on a temporary full-screen canvas. Cleans up after itself. */
export function confetti(originX = innerWidth / 2, originY = innerHeight / 3, count = 90): void {
  if (prefersReducedMotion()) return
  const canvas = document.createElement('canvas')
  const dpr = Math.min(devicePixelRatio || 1, 2)
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '100',
  })
  document.body.append(canvas)
  const g = canvas.getContext('2d')
  if (!g) return canvas.remove()
  g.scale(dpr, dpr)

  const colors = ['--accent', '--accent-2', '--gold', '--game-snake', '--game-tetris'].map((v) =>
    cssVar(v),
  )
  const pieces: Piece[] = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9
    const speed = 7 + Math.random() * 9
    return {
      x: originX,
      y: originY,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: 5 + Math.random() * 6,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)] ?? '#fff',
      round: Math.random() < 0.3,
    }
  })

  const started = performance.now()
  const LIFE = 1700
  function frame(now: number) {
    const t = now - started
    g!.clearRect(0, 0, innerWidth, innerHeight)
    g!.globalAlpha = Math.max(0, 1 - Math.max(0, t - LIFE * 0.6) / (LIFE * 0.4))
    for (const p of pieces) {
      p.vy += 0.32
      p.vx *= 0.985
      p.vy *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.angle += p.spin
      g!.save()
      g!.translate(p.x, p.y)
      g!.rotate(p.angle)
      g!.fillStyle = p.color
      if (p.round) {
        g!.beginPath()
        g!.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        g!.fill()
      } else {
        g!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      }
      g!.restore()
    }
    if (t < LIFE) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
