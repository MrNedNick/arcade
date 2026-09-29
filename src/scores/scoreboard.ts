import { readJSON, writeJSON } from '@/engine/storage'

export interface ScoreEntry {
  name: string
  score: number
  /** When the score was set, epoch ms. On equal scores the earlier one ranks higher. */
  at: number
  /** Optional short label shown next to the score, e.g. a game mode. */
  tag?: string
}

export type ScoreOrder = 'desc' | 'asc'

export const TOP_SIZE = 10

/**
 * Where top players live. The local board keeps them on this device; a shared
 * online board can implement the same interface later without touching the screens.
 */
export interface ScoreBoard {
  top(board: string): Promise<ScoreEntry[]>
  /** Rank (1-based) the score would take, or null if it does not make the top. */
  rankFor(board: string, score: number): Promise<number | null>
  submit(board: string, entry: ScoreEntry): Promise<{ rank: number | null; entries: ScoreEntry[] }>
}

export function compareEntries(order: ScoreOrder) {
  return (a: ScoreEntry, b: ScoreEntry) =>
    (order === 'desc' ? b.score - a.score : a.score - b.score) || a.at - b.at
}

/** Inserts an entry, sorts by score then by time, keeps the top ten. Pure. */
export function insertEntry(
  entries: readonly ScoreEntry[],
  entry: ScoreEntry,
  order: ScoreOrder,
  size = TOP_SIZE,
): { rank: number | null; entries: ScoreEntry[] } {
  const next = [...entries, entry].sort(compareEntries(order)).slice(0, size)
  const index = next.indexOf(entry)
  return { rank: index === -1 ? null : index + 1, entries: next }
}

export function rankOf(
  entries: readonly ScoreEntry[],
  score: number,
  order: ScoreOrder,
  size = TOP_SIZE,
): number | null {
  // A new score ranks after existing equal scores, because it was set later.
  return insertEntry(entries, { name: '', score, at: Number.MAX_SAFE_INTEGER }, order, size).rank
}

export class LocalScoreBoard implements ScoreBoard {
  constructor(
    private readonly orderOf: (board: string) => ScoreOrder,
    private readonly prefix = 'arcade:top:',
  ) {}

  private read(board: string): ScoreEntry[] {
    const raw = readJSON<unknown>(this.prefix + board, [])
    if (!Array.isArray(raw)) return []
    return raw
      .filter(
        (e): e is ScoreEntry =>
          !!e && typeof e.name === 'string' && Number.isFinite(e.score) && Number.isFinite(e.at),
      )
      .sort(compareEntries(this.orderOf(board)))
      .slice(0, TOP_SIZE)
  }

  async top(board: string) {
    return this.read(board)
  }

  async rankFor(board: string, score: number) {
    return rankOf(this.read(board), score, this.orderOf(board))
  }

  async submit(board: string, entry: ScoreEntry) {
    const result = insertEntry(this.read(board), entry, this.orderOf(board))
    if (result.rank !== null) writeJSON(this.prefix + board, result.entries)
    return result
  }
}
