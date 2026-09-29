import type { Component } from 'vue'
import type { GameId } from './ids'

export interface GameInfo {
  id: GameId
  title: string
  tagline: string
  /** Loads the playable game. Only games listed here are shown in the lobby. */
  load: () => Promise<{ default: Component }>
}

export const GAMES: GameInfo[] = []

export function findGame(id: unknown): GameInfo | undefined {
  return GAMES.find((g) => g.id === id)
}
