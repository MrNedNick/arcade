import { findGame } from '@/games/registry'
import { LocalScoreBoard, type ScoreBoard } from './scoreboard'

/** The board every screen talks to. Swap for a remote implementation to go online. */
export const scoreBoard: ScoreBoard = new LocalScoreBoard(
  (board) => findGame(board.split(':')[0])?.order ?? 'desc',
)
