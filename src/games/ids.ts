export const GAME_IDS = ['snake', 'tetris', 'minesweeper', 'sudoku', 'memory'] as const

export type GameId = (typeof GAME_IDS)[number]

export function isGameId(value: unknown): value is GameId {
  return typeof value === 'string' && (GAME_IDS as readonly string[]).includes(value)
}
