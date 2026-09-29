import type { Component } from 'vue'
import type { ScoreOrder } from '@/scores/scoreboard'
import type { GameId } from './ids'

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
  /** True when an unfinished game can be continued. */
  hasSave?: () => boolean
}

export const GAMES: GameInfo[] = []

export function findGame(id: unknown): GameInfo | undefined {
  return GAMES.find((g) => g.id === id)
}

export function formatScore(game: GameInfo, value: number): string {
  return game.formatScore ? game.formatScore(value) : value.toLocaleString('en-US')
}
