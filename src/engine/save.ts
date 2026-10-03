import { onBeforeUnmount, onMounted, reactive } from 'vue'
import type { GameId } from '@/games/ids'
import { readJSON } from './storage'

/**
 * One unfinished game per title, kept in localStorage. A game saves when the
 * player might be leaving — tab hidden, page closed, game left, paused — and
 * offers to continue the next time it opens.
 */
const VERSION = 1
const key = (game: GameId) => `arcade:save:${game}`

interface Envelope<T> {
  v: number
  at: number
  data: T
}

/** Which games have a save right now; reactive, so the lobby updates by itself. */
const saved = reactive(new Set<GameId>())

export function loadGame<T>(game: GameId): T | null {
  const env = readJSON<Envelope<T> | null>(key(game), null)
  if (!env || env.v !== VERSION || env.data == null) return null
  return env.data
}

export function saveGame<T>(game: GameId, data: T): void {
  try {
    localStorage.setItem(key(game), JSON.stringify({ v: VERSION, at: Date.now(), data }))
    saved.add(game)
  } catch {
    /* private mode or a full quota: nothing to continue next time */
  }
}

export function clearSave(game: GameId): void {
  try {
    localStorage.removeItem(key(game))
  } catch {
    /* ignore */
  }
  saved.delete(game)
}

export function hasSave(game: GameId): boolean {
  if (saved.has(game)) return true
  if (loadGame(game) === null) return false
  saved.add(game)
  return true
}

/**
 * Wires a game to the save slot. `snapshot` returns what to keep, null when the
 * game is over and nothing is worth continuing, or undefined to leave the slot
 * alone (the player has not started anything since the page opened).
 */
export function useAutosave<T>(
  game: GameId,
  snapshot: () => T | null | undefined,
): { flush: () => void } {
  const flush = () => {
    const data = snapshot()
    if (data === undefined) return
    if (data === null) clearSave(game)
    else saveGame(game, data)
  }
  const onVisibility = () => document.hidden && flush()
  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', flush)
    flush()
  })
  return { flush }
}
