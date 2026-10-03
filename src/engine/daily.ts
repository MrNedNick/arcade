import { reactive } from 'vue'
import { readJSON, writeJSON } from './storage'

/**
 * Daily puzzles: the same board for everyone on a calendar date, because the
 * random seed comes from the date itself. Results stay on this device.
 */
export type DailyGame = 'sudoku' | 'minesweeper'
export const DAILY_GAMES: DailyGame[] = ['sudoku', 'minesweeper']

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** A stable 32-bit seed for a game on a date (FNV-1a). */
export function dailySeed(game: DailyGame, date: string): number {
  let h = 0x811c9dc5
  for (const ch of `${game}:${date}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const KEY = 'arcade:daily'
/** game → date → best time in seconds. */
type Results = Record<DailyGame, Record<string, number>>

const results = reactive<Results>({
  sudoku: {},
  minesweeper: {},
  ...readJSON<Partial<Results>>(KEY, {}),
})

export function dailyResult(game: DailyGame, date = dateKey()): number | null {
  return results[game][date] ?? null
}

export function recordDaily(game: DailyGame, seconds: number, date = dateKey()): void {
  const prev = results[game][date]
  if (prev === undefined || seconds < prev) results[game][date] = seconds
  writeJSON(KEY, results)
}

function shift(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return dateKey(new Date(y, m - 1, d + days))
}

/**
 * Days in a row with at least one daily puzzle solved. Today not solved yet
 * does not break the streak — it is still running from yesterday.
 */
export function streak(today = dateKey(), data: Results = results): number {
  const solved = (date: string) => DAILY_GAMES.some((g) => data[g][date] !== undefined)
  let day = solved(today) ? today : shift(today, -1)
  let n = 0
  while (solved(day)) {
    n++
    day = shift(day, -1)
  }
  return n
}
