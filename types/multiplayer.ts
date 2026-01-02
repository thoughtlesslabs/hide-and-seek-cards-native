export interface LobbyPlayer {
  id: string
  username: string
  isBot: boolean
  isReady: boolean
  avatar: string
  connectedAt: number
  lastActivity?: number
}

export interface Lobby {
  id: string
  players: LobbyPlayer[]
  status: "waiting" | "starting" | "in-progress" | "finished"
  createdAt: number
  startTimer: number | null
  maxPlayers: number
  reactions?: Record<string, { emoji: string; timestamp: number }>
  roundsToWin: number // 1 for single game, 2 for best of 3, 3 for best of 5
}

export interface EmojiReaction {
  playerId: string
  emoji: string
  timestamp: number
}

export const ALLOWED_EMOJIS = ["👍", "😄", "😮", "😢", "😡", "👏", "🎉", "🤔"] as const
export type AllowedEmoji = (typeof ALLOWED_EMOJIS)[number]

export interface SharedCard {
  id: string
  ownerId: string
  isRevealed: boolean
  position: number
}

export interface SharedPlayer {
  id: string
  name: string
  isHuman: boolean
  isEliminated: boolean
  cardValue: number
  avatar: string
  seriesWins: number
}

export interface SharedGameState {
  lobbyId: string
  players: SharedPlayer[]
  cards: SharedCard[]
  currentPlayerIndex: number
  targetPlayerId: string | null
  phase:
    | "waiting"
    | "select_target"
    | "select_card"
    | "reveal_result"
    | "flipping"
    | "elimination_animation"
    | "game_over"
    | "round_end"
    | "series_end"
  lastMessage: string
  winner?: string | null
  winnerId: string | null
  turnStartTime: number | null
  lastMoveBy: string | null
  lastMoveTime: number | null
  version: number
  gameStartTime: number | null
  pendingEliminationId: string | null
  revealResultTime: number | null
  flippingStartTime: number | null
  eliminationAnimationTime: number | null
  currentRound: number
  roundEndTime: number | null
  roundWinnerId: string | null
  seriesWinnerId: string | null
  rematchVotes: string[]
  roundsToWin: number // 1, 2, or 3 (for 1 round, best of 3, best of 5)
}
