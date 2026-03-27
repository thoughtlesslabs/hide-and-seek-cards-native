"use server"

import { multiplayerService } from "@/lib/multiplayer-service"
import type { Lobby, LobbyPlayer, AllowedEmoji, SharedGameState } from "@/types/multiplayer"
import { ALLOWED_EMOJIS } from "@/types/multiplayer"

const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 100

function checkRateLimit(playerId: string): boolean {
  const now = Date.now()
  const lastRequest = rateLimitMap.get(playerId) || 0
  if (now - lastRequest < RATE_LIMIT_MS) {
    return false
  }
  rateLimitMap.set(playerId, now)
  if (rateLimitMap.size > 10000) {
    const cutoff = now - 60000
    for (const [key, time] of rateLimitMap.entries()) {
      if (time < cutoff) rateLimitMap.delete(key)
    }
  }
  return true
}

export async function joinMatchmaking(playerId: string, roundsToWin = 2, maxPlayers = 8): Promise<LobbyPlayer> {
  if (!playerId || typeof playerId !== "string") {
    throw new Error("Invalid player ID")
  }
  if (roundsToWin !== 1 && roundsToWin !== 2 && roundsToWin !== 3) {
    roundsToWin = 2
  }
  if (maxPlayers !== 4 && maxPlayers !== 8) {
    maxPlayers = 8
  }
  return await multiplayerService.joinQueue(playerId, roundsToWin, maxPlayers)
}

export async function getLobbyStatus(playerId: string): Promise<Lobby | null> {
  if (!playerId || typeof playerId !== "string") return null
  return await multiplayerService.getLobby(playerId)
}

export async function sendEmojiReaction(playerId: string, emoji: string): Promise<void> {
  if (!playerId || typeof playerId !== "string") return
  if (!ALLOWED_EMOJIS.includes(emoji as AllowedEmoji)) {
    throw new Error("Invalid emoji")
  }
  await multiplayerService.addReaction(playerId, emoji)
}

export async function leaveLobby(playerId: string): Promise<void> {
  if (!playerId || typeof playerId !== "string") return
  await multiplayerService.leaveLobby(playerId)
}

export async function finishGame(playerId: string): Promise<void> {
  if (!playerId || typeof playerId !== "string") return
  const lobby = await multiplayerService.getLobby(playerId)
  if (lobby) {
    await multiplayerService.finishGame(lobby.id)
  }
}

export async function leaveGame(playerId: string): Promise<void> {
  if (!playerId || typeof playerId !== "string") return
  await multiplayerService.leaveGame(playerId)
}

export async function sendHeartbeat(playerId: string): Promise<void> {
  if (!playerId || typeof playerId !== "string") return
  await multiplayerService.updatePlayerActivity(playerId)
}

export async function checkDisconnects(lobbyId: string): Promise<string[]> {
  if (!lobbyId || typeof lobbyId !== "string") return []
  return await multiplayerService.checkDisconnectedPlayers(lobbyId)
}

export async function getGameState(playerId: string): Promise<SharedGameState | null> {
  if (!playerId || typeof playerId !== "string") return null
  if (!checkRateLimit(playerId)) return null
  return await multiplayerService.getSharedGameState(playerId)
}

export async function getGameStateWithReactions(
  playerId: string,
): Promise<{ state: SharedGameState | null; reactions: Record<string, string> }> {
  if (!playerId || typeof playerId !== "string") return { state: null, reactions: {} }
  if (!checkRateLimit(playerId)) return { state: null, reactions: {} }
  return await multiplayerService.getSharedGameStateWithReactions(playerId)
}

export async function makeSelectTarget(playerId: string, targetId: string): Promise<SharedGameState | null> {
  if (!playerId || !targetId || typeof playerId !== "string" || typeof targetId !== "string") return null
  return await multiplayerService.selectTarget(playerId, targetId)
}

export async function makePickCard(
  playerId: string,
  cardId: string,
  targetId?: string,
): Promise<SharedGameState | null> {
  if (!playerId || !cardId || typeof playerId !== "string" || typeof cardId !== "string") return null
  return await multiplayerService.pickCard(playerId, cardId, targetId)
}

export const pickCard = makePickCard

export async function checkTurnTimeout(lobbyId: string): Promise<SharedGameState | null> {
  if (!lobbyId || typeof lobbyId !== "string") return null
  return await multiplayerService.checkTurnTimeout(lobbyId)
}

export async function getEmojiReactions(lobbyId: string): Promise<Record<string, string>> {
  if (!lobbyId || typeof lobbyId !== "string") return {}
  return await multiplayerService.getReactions(lobbyId)
}

export async function checkBotOnlyGame(lobbyId: string): Promise<boolean> {
  if (!lobbyId || typeof lobbyId !== "string") return false
  return await multiplayerService.checkAndTerminateBotOnlyGame(lobbyId)
}

export async function voteForRematch(playerId: string): Promise<SharedGameState | null> {
  if (!playerId || typeof playerId !== "string") return null
  return await multiplayerService.voteRematch(playerId)
}

export async function getGlobalStats(): Promise<{
  playersOnline: number
  gamesInProgress: number
  playersInQueue: number
}> {
  try {
    const stats = await multiplayerService.getGlobalStats()
    return stats
  } catch (error) {
    console.error("[v0] Error fetching global stats:", error)
    return { playersOnline: 0, gamesInProgress: 0, playersInQueue: 0 }
  }
}

export async function pollGameState(
  playerId: string,
): Promise<{ state: SharedGameState | null; reactions: Record<string, string> }> {
  if (!playerId || typeof playerId !== "string") return { state: null, reactions: {} }
  return await multiplayerService.getSharedGameStateWithReactions(playerId)
}

export async function selectTarget(playerId: string, targetId: string): Promise<SharedGameState | null> {
  if (!playerId || !targetId || typeof playerId !== "string" || typeof targetId !== "string") return null
  return await multiplayerService.selectTarget(playerId, targetId)
}

export async function selectCard(playerId: string, cardId: string, targetId?: string): Promise<SharedGameState | null> {
  if (!playerId || !cardId || typeof playerId !== "string" || typeof cardId !== "string") return null
  return await multiplayerService.pickCard(playerId, cardId, targetId)
}

export async function startRematchVote(playerId: string): Promise<SharedGameState | null> {
  if (!playerId || typeof playerId !== "string") return null
  return await multiplayerService.voteRematch(playerId)
}

export async function hostPrivateLobby(
  playerId: string,
  roundsToWin = 2,
  maxPlayers = 8,
): Promise<{ player: LobbyPlayer; gameCode: string }> {
  if (!playerId || typeof playerId !== "string") {
    throw new Error("Invalid player ID")
  }
  if (roundsToWin !== 1 && roundsToWin !== 2 && roundsToWin !== 3) {
    roundsToWin = 2
  }
  if (maxPlayers !== 4 && maxPlayers !== 8) {
    maxPlayers = 8
  }
  return await multiplayerService.hostPrivateLobby(playerId, roundsToWin, maxPlayers)
}

export async function joinByCode(
  playerId: string,
  gameCode: string,
): Promise<{ success: boolean; player?: LobbyPlayer; error?: string }> {
  if (!playerId || typeof playerId !== "string") {
    return { success: false, error: "Invalid player ID" }
  }
  if (!gameCode || typeof gameCode !== "string") {
    return { success: false, error: "Invalid game code" }
  }
  return await multiplayerService.joinByCode(playerId, gameCode)
}

export async function hostStartGame(playerId: string): Promise<{ success: boolean; error?: string }> {
  if (!playerId || typeof playerId !== "string") {
    return { success: false, error: "Invalid player ID" }
  }
  return await multiplayerService.hostStartGame(playerId)
}

export async function getLobbiesWaitingByConfig(): Promise<{
  fourPlayer: { single: number; bestOf3: number; bestOf5: number }
  eightPlayer: { single: number; bestOf3: number; bestOf5: number }
}> {
  try {
    return await multiplayerService.getLobbiesWaitingByConfig()
  } catch (error) {
    console.error("[v0] Error fetching lobbies by config:", error)
    return {
      fourPlayer: { single: 0, bestOf3: 0, bestOf5: 0 },
      eightPlayer: { single: 0, bestOf3: 0, bestOf5: 0 },
    }
  }
}
