export type PlayerId = string

export interface Player {
  id: PlayerId
  name: string
  isHuman: boolean
  isEliminated: boolean
  cardValue: number
  avatar: string
}

export interface Card {
  id: string
  ownerId: PlayerId
  isRevealed: boolean
  position: number
}

export enum GamePhase {
  WAITING = "WAITING",
  SELECT_TARGET = "SELECT_TARGET",
  SELECT_CARD = "SELECT_CARD",
  REVEAL_RESULT = "REVEAL_RESULT",
  GAME_OVER = "GAME_OVER",
}

export interface GameState {
  players: Player[]
  cards: Card[]
  currentPlayerIndex: number
  targetPlayerId: PlayerId | null
  phase: GamePhase
  lastMessage: string
  winner: Player | null
}
