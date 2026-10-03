import type { Component } from 'vue'
import type { ScoreOrder } from '@/scores/scoreboard'
import type { GameId } from './ids'
import SnakePreview from './snake/SnakePreview.vue'
import TetrisPreview from './tetris/TetrisPreview.vue'
import MinesweeperPreview from './minesweeper/MinesweeperPreview.vue'
import SudokuPreview from './sudoku/SudokuPreview.vue'
import MemoryPreview from './memory/MemoryPreview.vue'

export interface GameInfo {
  id: GameId
  title: string
  tagline: string
  /** Signature colour, a CSS custom property name. */
  color: string
  /** 'desc' when more is better (points), 'asc' when less is better (time). */
  order: ScoreOrder
  scoreLabel: string
  formatScore?: (value: number) => string
  /** Small animated scene for the lobby card. */
  preview: Component
  /** Loads the playable game. Only games listed here appear in the lobby. */
  load: () => Promise<{ default: Component }>
  /** Separate top players boards, e.g. one per difficulty. Board id is `${game}:${variant}`. */
  variants?: { id: string; label: string }[]
}

export const GAMES: GameInfo[] = [
  {
    id: 'snake',
    title: 'Snake',
    tagline: 'Eat, grow, don’t bite yourself.',
    color: '--game-snake',
    order: 'desc',
    scoreLabel: 'Score',
    preview: SnakePreview,
    load: () => import('./snake/SnakeGame.vue'),
  },
  {
    id: 'tetris',
    title: 'Tetris',
    tagline: 'Stack, clear, go for four at once.',
    color: '--game-tetris',
    order: 'desc',
    scoreLabel: 'Score',
    preview: TetrisPreview,
    load: () => import('./tetris/TetrisGame.vue'),
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    tagline: 'Read the numbers, flag the mines, clear the field.',
    color: '--game-minesweeper',
    order: 'asc',
    scoreLabel: 'Time',
    formatScore: (s) => formatTime(s),
    preview: MinesweeperPreview,
    load: () => import('./minesweeper/MinesweeperGame.vue'),
    variants: [
      { id: 'easy', label: 'Easy' },
      { id: 'medium', label: 'Medium' },
      { id: 'hard', label: 'Hard' },
    ],
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    tagline: 'Nine by nine, one answer, no guessing needed.',
    color: '--game-sudoku',
    order: 'asc',
    scoreLabel: 'Time',
    formatScore: (s) => formatTime(s),
    preview: SudokuPreview,
    load: () => import('./sudoku/SudokuGame.vue'),
    variants: [
      { id: 'easy', label: 'Easy' },
      { id: 'medium', label: 'Medium' },
      { id: 'hard', label: 'Hard' },
    ],
  },
  {
    id: 'memory',
    title: 'Memory',
    tagline: 'Turn two, remember everything, find every pair.',
    color: '--game-memory',
    order: 'asc',
    scoreLabel: 'Time',
    formatScore: (s) => formatTime(s),
    preview: MemoryPreview,
    load: () => import('./memory/MemoryGame.vue'),
    variants: [
      { id: 'small', label: '4 × 4' },
      { id: 'medium', label: '4 × 6' },
      { id: 'large', label: '6 × 6' },
    ],
  },
]

export function findGame(id: unknown): GameInfo | undefined {
  return GAMES.find((g) => g.id === id)
}

/** Every board of a game: its variants, or just the game itself. */
export function boardsOf(game: GameInfo): { id: string; label: string }[] {
  return (
    game.variants?.map((v) => ({ id: `${game.id}:${v.id}`, label: v.label })) ?? [
      { id: game.id, label: game.title },
    ]
  )
}

/** Minutes and seconds for time-based games; a negative value means "no record yet". */
export function formatTime(seconds: number): string {
  if (seconds < 0) return '—'
  const m = Math.floor(seconds / 60)
  return `${m}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export function formatScore(game: GameInfo, value: number): string {
  return game.formatScore ? game.formatScore(value) : value.toLocaleString('en-US')
}
