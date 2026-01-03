import { redis, REDIS_KEYS as IMPORTED_REDIS_KEYS, REDIS_TTL as IMPORTED_REDIS_TTL } from "./redis"
import type { Lobby, LobbyPlayer, SharedGameState, SharedPlayer, SharedCard } from "@/types/multiplayer"
import { generateUsername } from "./username-generator"

const LOBBY_TIMER_MS = 30000
const TURN_TIMEOUT_MS = 8000
const DISCONNECT_TIMEOUT_MS = 60000
const GAME_START_DELAY_MS = 3000
const BOT_NAMES = ["Silas", "Morgana", "Thorne", "Valeria", "Corvus", "Nyx", "Grimm", "Elara"]
const BOT_AVATAR_SEEDS = ["mystic", "shadow", "ember", "frost", "storm", "void", "phantom", "oracle"]
const BOT_THINKING_DELAY_MS = 1500
const REVEAL_RESULT_DURATION_MS = 2000
const FLIP_ANIMATION_DURATION_MS = 1000
const ELIMINATION_ANIMATION_DURATION_MS = 1500
const ROUND_END_DELAY_MS = 3000
const CLOCKWISE_ORDER_4 = [0, 3, 2, 1] // S(0) -> E(6->idx3) -> N(4->idx2) -> W(2->idx1) based on player indices 0,1,2,3 mapped to visual S,W,N,E
const CLOCKWISE_ORDER_8 = [0, 7, 6, 5, 4, 3, 2, 1] // Clockwise: S -> SE -> E -> NE -> N -> NW -> W -> SW

const REDIS_TTL = {
  ...IMPORTED_REDIS_TTL,
  GAME: 1800,
  ACTIVITY: 120,
  REACTIONS: 60,
}

const REDIS_KEYS = {
  LOBBY: IMPORTED_REDIS_KEYS.LOBBY,
  PLAYER_LOBBY: IMPORTED_REDIS_KEYS.PLAYER_LOBBY,
  PLAYER_INFO: IMPORTED_REDIS_KEYS.PLAYER_INFO,
  GAME_STATE: IMPORTED_REDIS_KEYS.GAME_STATE,
  WAITING_LOBBIES: IMPORTED_REDIS_KEYS.WAITING_LOBBIES,
  PLAYER_ACTIVITY: (id: string) => `player:activity:${id}`,
  REACTIONS: (lobbyId: string) => `reactions:${lobbyId}`,
  GAME_CODE: (code: string) => `gamecode:${code}`,
}

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id)
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
}

function generateBot(existingPlayers: LobbyPlayer[] = []): LobbyPlayer {
  // Get names and seeds already in use
  const usedNames = new Set(existingPlayers.filter((p) => p.isBot).map((p) => p.username))
  const usedSeeds = new Set(
    existingPlayers
      .filter((p) => p.isBot)
      .map((p) => {
        const match = p.avatar?.match(/seed=([^&]+)/)
        return match ? match[1] : null
      })
      .filter(Boolean),
  )

  // Find an available name
  let botName = BOT_NAMES.find((name) => !usedNames.has(name))
  if (!botName) {
    // Fallback if all names used (shouldn't happen with 8 max players)
    botName = `Bot${Date.now().toString().slice(-4)}`
  }

  // Find an available seed for avatar
  let avatarSeed = BOT_AVATAR_SEEDS.find((seed) => !usedSeeds.has(seed))
  if (!avatarSeed) {
    avatarSeed = `bot${Date.now()}`
  }

  return {
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: botName,
    isBot: true,
    isReady: true,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
  }
}

function safeJsonParse<T>(data: unknown, fallback: T): T {
  if (data === null || data === undefined) return fallback

  // If it's already an object (from old automatic deserialization), return it
  if (typeof data === "object") {
    return data as T
  }

  // If it's a string, try to parse it
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T
    } catch {
      return fallback
    }
  }

  return fallback
}

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value
  return []
}

function createPlayer(playerId: string): LobbyPlayer {
  const username = generateUsername()
  return {
    id: playerId,
    username,
    isBot: false,
    isReady: true,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username.toLowerCase()}`,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
  }
}

async function saveLobby(lobby: Lobby): Promise<void> {
  try {
    await redis.set(REDIS_KEYS.LOBBY(lobby.id), JSON.stringify(lobby), { ex: REDIS_TTL.LOBBY })
  } catch (e) {
    console.error("[v0] Error saving lobby:", e)
  }
}

async function getLobbyById(lobbyId: string): Promise<Lobby | null> {
  if (!isValidId(lobbyId)) return null
  try {
    const data = await redis.get(REDIS_KEYS.LOBBY(lobbyId))
    if (!data) return null

    const lobby = safeJsonParse<Lobby | null>(data, null)
    if (!lobby) return null

    // Ensure players is always an array
    lobby.players = ensureArray(lobby.players)
    // Ensure reactions is a valid object
    lobby.reactions =
      typeof lobby.reactions === "object" && lobby.reactions !== null && !Array.isArray(lobby.reactions)
        ? lobby.reactions
        : {}

    return lobby
  } catch (e) {
    console.error("[v0] Error getting lobby:", e)
    try {
      await redis.del(REDIS_KEYS.LOBBY(lobbyId))
    } catch {}
    return null
  }
}

async function getPlayerLobbyId(playerId: string): Promise<string | null> {
  if (!isValidId(playerId)) return null
  try {
    const lobbyId = await redis.get(REDIS_KEYS.PLAYER_LOBBY(playerId))
    if (!lobbyId) return null
    // Handle both string and object cases
    if (typeof lobbyId === "string") return lobbyId
    if (typeof lobbyId === "object" && lobbyId !== null) {
      // Old format might have stored as object
      return String(lobbyId)
    }
    return null
  } catch (e) {
    console.error("[v0] Error getting player lobby:", e)
    return null
  }
}

async function setPlayerLobby(playerId: string, lobbyId: string): Promise<void> {
  try {
    await redis.set(REDIS_KEYS.PLAYER_LOBBY(playerId), lobbyId, { ex: REDIS_TTL.PLAYER_MAPPING })
  } catch (e) {
    console.error("[v0] Error setting player lobby:", e)
  }
}

async function removePlayerLobby(playerId: string): Promise<void> {
  try {
    await redis.del(REDIS_KEYS.PLAYER_LOBBY(playerId))
  } catch (e) {
    console.error("[v0] Error removing player lobby:", e)
  }
}

async function getPlayerInfo(playerId: string): Promise<LobbyPlayer | null> {
  if (!isValidId(playerId)) return null
  try {
    const data = await redis.get(REDIS_KEYS.PLAYER_INFO(playerId))
    if (!data) return null
    return safeJsonParse<LobbyPlayer | null>(data, null)
  } catch (e) {
    console.error("[v0] Error getting player info:", e)
    return null
  }
}

async function setPlayerInfo(playerId: string, player: LobbyPlayer): Promise<void> {
  try {
    await redis.set(REDIS_KEYS.PLAYER_INFO(playerId), JSON.stringify(player), { ex: REDIS_TTL.PLAYER_MAPPING })
  } catch (e) {
    console.error("[v0] Error setting player info:", e)
  }
}

async function saveGameState(lobbyId: string, state: SharedGameState): Promise<void> {
  try {
    await redis.set(REDIS_KEYS.GAME_STATE(lobbyId), JSON.stringify(state), { ex: REDIS_TTL.GAME })
  } catch (e) {
    console.error("[v0] Error saving game state:", e)
  }
}

async function getGameState(lobbyId: string): Promise<SharedGameState | null> {
  if (!isValidId(lobbyId)) return null
  try {
    const data = await redis.get(REDIS_KEYS.GAME_STATE(lobbyId))
    if (!data) return null

    let state: SharedGameState | null = null

    // Handle both already-parsed objects and strings
    if (typeof data === "object" && data !== null) {
      state = data as SharedGameState
    } else if (typeof data === "string") {
      try {
        state = JSON.parse(data) as SharedGameState
      } catch {
        return null
      }
    }

    if (!state) return null

    // Ensure arrays are valid - defensive checks
    if (!Array.isArray(state.players)) state.players = []
    if (!Array.isArray(state.cards)) state.cards = []
    if (!Array.isArray(state.rematchVotes)) state.rematchVotes = []

    return state
  } catch (e) {
    console.error("[v0] Error getting game state:", e)
    // Delete corrupted data
    try {
      await redis.del(REDIS_KEYS.GAME_STATE(lobbyId))
    } catch {}
    return null
  }
}

async function initializeGame(lobby: Lobby, maxPlayers: number): Promise<SharedGameState> {
  const lobbyPlayers = ensureArray<LobbyPlayer>(lobby.players)
  if (lobbyPlayers.length === 0) {
    throw new Error("Cannot initialize game with no players")
  }

  const players: SharedPlayer[] = lobbyPlayers.map((p, idx) => ({
    id: p.id,
    name: p.username,
    isHuman: !p.isBot,
    isEliminated: false,
    cardValue: idx,
    avatar: p.avatar,
    seriesWins: 0,
  }))

  const cards: SharedCard[] = players.map((p, idx) => ({
    id: `card-${idx}`,
    ownerId: p.id,
    isRevealed: false,
    position: idx,
  }))

  const shuffledCards = cards.sort(() => Math.random() - 0.5).map((c, idx) => ({ ...c, position: idx }))
  const startingPlayerIndex = Math.floor(Math.random() * players.length)

  const state: SharedGameState = {
    lobbyId: lobby.id,
    players,
    cards: shuffledCards,
    currentPlayerIndex: startingPlayerIndex,
    targetPlayerId: null,
    phase: "select_target",
    lastMessage: `${players[startingPlayerIndex]?.name}'s turn to choose a target...`,
    winnerId: null,
    turnStartTime: Date.now(),
    lastMoveBy: null,
    lastMoveTime: null,
    version: 1,
    gameStartTime: Date.now(),
    pendingEliminationId: null,
    revealResultTime: null,
    flippingStartTime: null,
    eliminationAnimationTime: null,
    currentRound: 1,
    roundEndTime: null,
    roundWinnerId: null,
    seriesWinnerId: null,
    rematchVotes: [],
    roundsToWin: lobby.roundsToWin || 2,
  }
  await saveGameState(state.lobbyId, state)
  return state
}

async function checkAndHandleLobbyTimer(lobby: Lobby, maxPlayers: number): Promise<Lobby> {
  if (lobby.status !== "waiting") return lobby

  if (lobby.isPrivate) return lobby

  const now = Date.now()
  const timerExpired = lobby.startTimer && now >= lobby.startTimer

  if (timerExpired && lobby.players.length > 0) {
    console.log(
      "[v0] Timer expired, starting game with",
      lobby.players.length,
      "players, adding bots to fill",
      maxPlayers,
    )

    while (lobby.players.length < maxPlayers) {
      lobby.players.push(generateBot(lobby.players))
    }

    lobby.status = "starting"
    lobby.startTimer = null

    await redis.zrem(REDIS_KEYS.WAITING_LOBBIES, lobby.id)
    await initializeGame(lobby, maxPlayers)
    lobby.status = "in-progress"
    await saveLobby(lobby)

    console.log("[v0] Game started successfully, status:", lobby.status)
  }

  return lobby
}

export async function joinQueue(playerId: string, roundsToWin = 2, maxPlayers = 8): Promise<LobbyPlayer> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) {
    throw new Error("Invalid player ID")
  }

  const existingLobbyId = await getPlayerLobbyId(sanitizedId)
  if (existingLobbyId) {
    const existingLobby = await getLobbyById(existingLobbyId)
    if (existingLobby) {
      const gameState = await getGameState(existingLobby.id)
      const gameIsFinished =
        gameState?.phase === "game_over" || gameState?.phase === "series_end" || existingLobby.status === "finished"

      if (!gameIsFinished) {
        const existingPlayer = existingLobby.players.find((p) => p.id === sanitizedId)
        if (existingPlayer) {
          return existingPlayer
        }
      }
      await removePlayerLobby(sanitizedId)
    } else {
      await removePlayerLobby(sanitizedId)
    }
  }

  let player = await getPlayerInfo(sanitizedId)
  if (!player) {
    player = createPlayer(sanitizedId)
    await setPlayerInfo(sanitizedId, player)
  } else {
    player.lastActivity = Date.now()
    await setPlayerInfo(sanitizedId, player)
  }

  const waitingLobbyIds = await redis.zrange(REDIS_KEYS.WAITING_LOBBIES, 0, -1)

  for (const lobbyId of waitingLobbyIds) {
    const lobby = await getLobbyById(lobbyId as string)
    if (
      lobby &&
      lobby.status === "waiting" &&
      !lobby.isPrivate &&
      lobby.maxPlayers === maxPlayers &&
      lobby.players.length < maxPlayers &&
      lobby.roundsToWin === roundsToWin
    ) {
      const alreadyInLobby = lobby.players.some((p) => p.id === sanitizedId)
      if (alreadyInLobby) continue

      lobby.players.push(player)
      await setPlayerLobby(sanitizedId, lobby.id)

      if (lobby.players.length >= maxPlayers) {
        lobby.status = "starting"
        lobby.startTimer = null
        await redis.zrem(REDIS_KEYS.WAITING_LOBBIES, lobby.id)
        await initializeGame(lobby, maxPlayers)
        lobby.status = "in-progress"
      }

      await saveLobby(lobby)
      return player
    }
  }

  const lobbyId = `lobby-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const newLobby: Lobby = {
    id: lobbyId,
    players: [player],
    status: "waiting",
    createdAt: Date.now(),
    startTimer: Date.now() + LOBBY_TIMER_MS,
    maxPlayers,
    reactions: {},
    roundsToWin,
    isPrivate: false,
  }

  await saveLobby(newLobby)
  await setPlayerLobby(sanitizedId, lobbyId)
  await redis.zadd(REDIS_KEYS.WAITING_LOBBIES, { score: Date.now(), member: lobbyId })

  return player
}

export async function getLobby(playerId: string): Promise<Lobby | null> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) return null

  const lobbyId = await getPlayerLobbyId(sanitizedId)
  if (!lobbyId) return null

  let lobby = await getLobbyById(lobbyId)
  if (!lobby) {
    await removePlayerLobby(sanitizedId)
    return null
  }

  const maxPlayers = lobby.maxPlayers || 8
  lobby = await checkAndHandleLobbyTimer(lobby, maxPlayers)
  return lobby
}

export async function leaveLobby(playerId: string): Promise<void> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) return

  // Always try to remove player mapping first, even if other operations fail
  try {
    await removePlayerLobby(sanitizedId)
  } catch (e) {
    console.log("[v0] Error removing player lobby mapping:", e)
    // Force delete the key directly
    try {
      await redis.del(REDIS_KEYS.PLAYER_LOBBY(sanitizedId))
    } catch (e2) {
      console.log("[v0] Error force deleting player lobby key:", e2)
    }
  }

  let lobbyId: string | null = null
  try {
    lobbyId = await getPlayerLobbyId(sanitizedId)
  } catch (e) {
    console.log("[v0] Error getting player lobby id during leave:", e)
    return // Player mapping already cleared above
  }

  if (!lobbyId) return

  let lobby: Lobby | null = null
  try {
    lobby = await getLobbyById(lobbyId)
  } catch (e) {
    console.log("[v0] Error getting lobby during leave:", e)
    return // Player mapping already cleared above
  }

  if (!lobby) return

  if (lobby.status === "waiting") {
    lobby.players = lobby.players.filter((p) => p.id !== sanitizedId)

    if (lobby.players.length === 0) {
      if (lobby.isPrivate && lobby.gameCode) {
        try {
          await redis.del(REDIS_KEYS.GAME_CODE(lobby.gameCode))
        } catch (e) {
          console.log("[v0] Error deleting game code:", e)
        }
      }
      try {
        await redis.del(REDIS_KEYS.LOBBY(lobbyId))
        await redis.zrem(REDIS_KEYS.WAITING_LOBBIES, lobbyId)
      } catch (e) {
        console.log("[v0] Error deleting lobby:", e)
      }
    } else {
      if (lobby.hostId === sanitizedId && lobby.players.length > 0) {
        lobby.hostId = lobby.players[0].id
      }
      try {
        await saveLobby(lobby)
      } catch (e) {
        console.log("[v0] Error saving lobby after leave:", e)
      }
    }
  }
}

export async function addReaction(playerId: string, emoji: string): Promise<void> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) return

  const lobbyId = await getPlayerLobbyId(sanitizedId)
  console.log("[v0] addReaction - playerId:", playerId, "sanitizedId:", sanitizedId, "lobbyId:", lobbyId)
  if (!lobbyId) return

  const allowedEmojis = ["👍", "😄", "😮", "😢", "😡", "👏", "🎉", "🤔"]
  if (!allowedEmojis.includes(emoji)) return

  const lobby = await getLobbyById(lobbyId)
  if (!lobby) return

  const reactions = lobby.reactions || {}
  reactions[sanitizedId] = { emoji, timestamp: Date.now() }
  lobby.reactions = reactions
  console.log("[v0] Saving reaction - reactions:", JSON.stringify(reactions))

  await saveLobby(lobby)
}

export async function getReactions(lobbyId: string): Promise<Record<string, string>> {
  if (!isValidId(lobbyId)) return {}

  const lobby = await getLobbyById(lobbyId)
  if (!lobby || !lobby.reactions) return {}

  const now = Date.now()
  const validReactions: Record<string, string> = {}
  let hasExpired = false

  for (const [pId, data] of Object.entries(lobby.reactions)) {
    const age = now - data.timestamp
    if (age < 5000) {
      validReactions[pId] = data.emoji
    } else {
      hasExpired = true
      delete lobby.reactions[pId]
    }
  }

  if (hasExpired) {
    await saveLobby(lobby)
  }

  if (Object.keys(validReactions).length > 0) {
    console.log("[v0] getReactions returning:", JSON.stringify(validReactions))
  }

  return validReactions
}

export async function updatePlayerActivity(playerId: string): Promise<void> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) return
  await redis.set(REDIS_KEYS.PLAYER_ACTIVITY(sanitizedId), Date.now().toString(), { ex: REDIS_TTL.ACTIVITY })
}

export async function checkDisconnectedPlayers(lobbyId: string): Promise<string[]> {
  if (!isValidId(lobbyId)) return []

  const state = await getGameState(lobbyId)
  if (!state) return []

  // Only check during active turn phases
  if (state.phase !== "select_target" && state.phase !== "select_card") {
    return []
  }

  const disconnected: string[] = []
  const now = Date.now()

  // Only check the current player, not all players
  const currentPlayer = state.players[state.currentPlayerIndex]
  if (!currentPlayer || !currentPlayer.isHuman || currentPlayer.isEliminated) {
    return []
  }

  const lastActivity = await redis.get(REDIS_KEYS.PLAYER_ACTIVITY(currentPlayer.id))
  const activityTime = lastActivity ? Number.parseInt(lastActivity as string) : 0

  // Only convert to bot if they've been inactive AND their turn has timed out
  const turnElapsed = now - (state.turnStartTime || now)
  if (now - activityTime > DISCONNECT_TIMEOUT_MS && turnElapsed > TURN_TIMEOUT_MS) {
    currentPlayer.isHuman = false
    currentPlayer.name = `${currentPlayer.name} (Bot)`
    disconnected.push(currentPlayer.id)

    state.version++
    await saveGameState(state.lobbyId, state)
  }

  return disconnected
}

export async function leaveGame(playerId: string): Promise<void> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) return

  const lobbyId = await getPlayerLobbyId(sanitizedId)
  if (!lobbyId) return

  const state = await getGameState(lobbyId)
  if (!state) return

  const player = state.players.find((p) => p.id === sanitizedId)
  if (player && !player.isEliminated) {
    player.isHuman = false
    player.name = `${player.name} (Bot)`
    state.version++
    await saveGameState(state.lobbyId, state)
  }

  await removePlayerLobby(sanitizedId)
  await redis.del(REDIS_KEYS.PLAYER_ACTIVITY(sanitizedId))
}

export async function finishGame(lobbyId: string): Promise<void> {
  if (!isValidId(lobbyId)) return

  const state = await getGameState(lobbyId)
  const playerIds = state?.players.map((p) => p.id).filter((id) => !id.startsWith("bot-")) || []

  await cleanupGameResources(lobbyId, playerIds)
}

export async function checkAndTerminateBotOnlyGame(lobbyId: string): Promise<boolean> {
  if (!isValidId(lobbyId)) return false

  const state = await getGameState(lobbyId)
  if (!state) return false

  if (
    state.phase === "game_over" ||
    state.phase === "reveal_result" ||
    state.phase === "elimination_animation" ||
    state.pendingEliminationId
  ) {
    return false
  }

  const hasAnyHumanPlayers = state.players.some((p) => p.isHuman)

  if (!hasAnyHumanPlayers) {
    const playerIds = state.players.map((p) => p.id).filter((id) => !id.startsWith("bot-"))
    await cleanupGameResources(lobbyId, playerIds)
    return true
  }

  return false
}

export async function getSharedGameState(playerId: string): Promise<SharedGameState | null> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) return null

  const lobbyId = await getPlayerLobbyId(sanitizedId)
  if (!lobbyId) return null

  const state = await getGameState(lobbyId)
  if (!state) return null

  const processedState = await processGameTick(state)
  return processedState
}

async function processGameTick(state: SharedGameState): Promise<SharedGameState> {
  const now = Date.now()

  if (state.phase === "round_end" && state.roundEndTime) {
    const elapsed = now - state.roundEndTime
    if (elapsed >= ROUND_END_DELAY_MS) {
      return await startNextRound(state)
    }
    return state
  }

  // Don't process during transitional phases or series_end
  if (
    state.phase === "game_over" ||
    state.phase === "series_end" ||
    state.phase === "reveal_result" ||
    state.phase === "flipping" ||
    state.phase === "elimination_animation"
  ) {
    // Handle reveal result duration
    if (state.phase === "reveal_result" && state.revealResultTime) {
      const elapsed = now - state.revealResultTime
      if (elapsed >= REVEAL_RESULT_DURATION_MS) {
        return await processAfterReveal(state)
      }
    }

    // Handle flipping duration
    if (state.phase === "flipping" && state.flippingStartTime) {
      const elapsed = now - state.flippingStartTime
      if (elapsed >= FLIP_ANIMATION_DURATION_MS) {
        return await processAfterFlipping(state)
      }
    }

    // Handle elimination animation duration
    if (state.phase === "elimination_animation" && state.eliminationAnimationTime) {
      const elapsed = now - state.eliminationAnimationTime
      if (elapsed >= ELIMINATION_ANIMATION_DURATION_MS) {
        return await processAfterElimination(state)
      }
    }

    return state
  }

  const currentPlayer = state.players[state.currentPlayerIndex]
  if (!currentPlayer || currentPlayer.isEliminated) {
    return state
  }

  if (state.turnStartTime) {
    const elapsed = now - state.turnStartTime
    if (elapsed >= TURN_TIMEOUT_MS) {
      return await handleTurnTimeout(state)
    }
  }

  if (!currentPlayer.isHuman) {
    if (state.turnStartTime) {
      const elapsed = now - state.turnStartTime
      if (elapsed >= BOT_THINKING_DELAY_MS) {
        return await processBotTurnImmediate(state)
      }
    }
    return state
  }

  return state
}

async function processAfterReveal(state: SharedGameState): Promise<SharedGameState> {
  // Flip cards back first
  state.cards = state.cards.map((c) => ({ ...c, isRevealed: false }))

  if (state.pendingEliminationId) {
    const playerIndex = state.players.findIndex((p) => p.id === state.pendingEliminationId)
    if (playerIndex !== -1) {
      state.players[playerIndex].isEliminated = true
    }

    const eliminatedPlayer = state.players.find((p) => p.id === state.pendingEliminationId)
    if (eliminatedPlayer) {
      state.cards = state.cards.filter((c) => c.ownerId !== eliminatedPlayer.id)
    }

    state.phase = "elimination_animation"
    state.eliminationAnimationTime = Date.now()
    state.revealResultTime = null
  } else {
    // No elimination - go to flipping phase, shuffle happens after
    state.phase = "flipping"
    state.flippingStartTime = Date.now()
    state.revealResultTime = null
  }

  state.version++
  await saveGameState(state.lobbyId, state)
  return state
}

async function processAfterFlipping(state: SharedGameState): Promise<SharedGameState> {
  state.cards = state.cards.map((c) => ({ ...c, isRevealed: false }))

  // Then shuffle cards
  state.cards = state.cards.sort(() => Math.random() - 0.5).map((c, idx) => ({ ...c, position: idx }))

  // Move to next player directly
  const currentIndex = state.currentPlayerIndex
  let nextIndex = getNextClockwiseIndex(currentIndex, state.players.length)
  let attempts = 0
  while (state.players[nextIndex]?.isEliminated && attempts < state.players.length) {
    nextIndex = getNextClockwiseIndex(nextIndex, state.players.length)
    attempts++
  }

  state.currentPlayerIndex = nextIndex
  state.targetPlayerId = null
  state.phase = "select_target"
  state.turnStartTime = Date.now()
  state.flippingStartTime = null

  const nextPlayer = state.players[nextIndex]
  state.lastMessage = `${nextPlayer?.name}'s turn to choose a target...`

  state.version++
  await saveGameState(state.lobbyId, state)
  return state
}

async function processAfterElimination(state: SharedGameState): Promise<SharedGameState> {
  state.cards = state.cards.map((c) => ({ ...c, isRevealed: false }))

  // Shuffle cards after elimination
  state.cards = state.cards.sort(() => Math.random() - 0.5).map((c, idx) => ({ ...c, position: idx }))

  const activePlayers = state.players.filter((p) => !p.isEliminated)

  if (activePlayers.length <= 1) {
    const winner = activePlayers[0]

    if (winner) {
      // Increment the round winner's series wins
      const winnerIndex = state.players.findIndex((p) => p.id === winner.id)
      if (winnerIndex !== -1) {
        state.players[winnerIndex].seriesWins++
      }

      const updatedWinner = state.players[winnerIndex]

      // Check if this player has won the series (best of 3 = 2 wins)
      if (updatedWinner.seriesWins >= state.roundsToWin) {
        // Series is over
        state.phase = "series_end"
        state.winner = winner.name
        state.winnerId = winner.id
        state.seriesWinnerId = winner.id
        state.roundWinnerId = winner.id
        state.lastMessage = `${winner.name} wins the series!`
      } else {
        // Round is over, but series continues
        state.phase = "round_end"
        state.roundWinnerId = winner.id
        state.roundEndTime = Date.now()
        state.lastMessage = `${winner.name} wins Round ${state.currentRound}!`
      }
    } else {
      // No winner (edge case)
      state.phase = "series_end"
      state.winner = "No one"
      state.winnerId = null
      state.seriesWinnerId = null
      state.lastMessage = "No survivors..."
    }

    state.pendingEliminationId = null
    state.eliminationAnimationTime = null
    state.version++
    await saveGameState(state.lobbyId, state)
    return state
  }

  // Move to next player
  const currentIndex = state.currentPlayerIndex
  let nextIndex = getNextClockwiseIndex(currentIndex, state.players.length)
  let attempts = 0
  while (state.players[nextIndex]?.isEliminated && attempts < state.players.length) {
    nextIndex = getNextClockwiseIndex(nextIndex, state.players.length)
    attempts++
  }

  state.currentPlayerIndex = nextIndex
  state.targetPlayerId = null

  state.phase = "select_target"
  state.turnStartTime = Date.now()
  state.flippingStartTime = null
  state.pendingEliminationId = null
  state.eliminationAnimationTime = null

  const nextPlayer = state.players[nextIndex]
  state.lastMessage = `${nextPlayer?.name}'s turn to choose a target...`

  state.version++
  await saveGameState(state.lobbyId, state)
  return state
}

async function handleTurnTimeout(state: SharedGameState): Promise<SharedGameState> {
  const currentPlayer = state.players[state.currentPlayerIndex]

  if (state.phase === "select_target") {
    const validTargets = state.players.filter((p) => !p.isEliminated && p.id !== currentPlayer.id)
    if (validTargets.length > 0) {
      const target = validTargets[Math.floor(Math.random() * validTargets.length)]
      state.targetPlayerId = target.id
      state.phase = "select_card"
      state.lastMessage = `Time's up! ${currentPlayer.name} auto-targets ${target.name}.`
      state.turnStartTime = Date.now()
      state.version++
      await saveGameState(state.lobbyId, state)
    }
  } else if (state.phase === "select_card") {
    const availableCards = state.cards.filter((c) => !c.isRevealed)
    if (availableCards.length > 0) {
      const card = availableCards[Math.floor(Math.random() * availableCards.length)]
      return await executeCardPick(state, card.id, currentPlayer)
    }
  }

  return state
}

async function processBotTurnImmediate(state: SharedGameState): Promise<SharedGameState> {
  const currentPlayer = state.players[state.currentPlayerIndex]
  if (!currentPlayer || currentPlayer.isHuman || currentPlayer.isEliminated) {
    return state
  }

  if (state.phase === "select_target") {
    const validTargets = state.players.filter((p) => !p.isEliminated && p.id !== currentPlayer.id)
    if (validTargets.length > 0) {
      const target = validTargets[Math.floor(Math.random() * validTargets.length)]
      state.targetPlayerId = target.id
      state.phase = "select_card"
      state.lastMessage = `${currentPlayer.name} targets ${target.name}...`
      state.turnStartTime = Date.now()
      state.version++
      await saveGameState(state.lobbyId, state)
    }
  } else if (state.phase === "select_card") {
    const availableCards = state.cards.filter((c) => !c.isRevealed)
    if (availableCards.length > 0) {
      const card = availableCards[Math.floor(Math.random() * availableCards.length)]
      return await executeCardPick(state, card.id, currentPlayer)
    }
  }

  return state
}

async function executeCardPick(
  state: SharedGameState,
  cardId: string,
  currentPlayer: SharedPlayer,
): Promise<SharedGameState> {
  const cardIndex = state.cards.findIndex((c) => c.id === cardId)
  if (cardIndex === -1) return state

  const card = state.cards[cardIndex]
  if (card.isRevealed) return state

  state.cards[cardIndex].isRevealed = true

  const cardOwner = state.players.find((p) => p.id === card.ownerId)
  let message = ""

  if (card.ownerId === currentPlayer.id) {
    message = `${currentPlayer.name} drew their own card! Self-elimination!`
    state.pendingEliminationId = currentPlayer.id
  } else if (card.ownerId === state.targetPlayerId) {
    message = `${currentPlayer.name} found ${cardOwner?.name}'s card! ${cardOwner?.name} is eliminated!`
    state.pendingEliminationId = state.targetPlayerId
  } else {
    message = `${currentPlayer.name} revealed ${cardOwner?.name}'s card. A miss...`
    state.pendingEliminationId = null
  }

  state.lastMessage = message
  state.phase = "reveal_result"
  state.revealResultTime = Date.now()
  state.lastMoveBy = currentPlayer.id
  state.lastMoveTime = Date.now()
  state.version++

  await saveGameState(state.lobbyId, state)
  return state
}

export async function selectTarget(playerId: string, targetId: string): Promise<SharedGameState | null> {
  const sanitizedPlayerId = sanitizeId(playerId)
  const sanitizedTargetId = sanitizeId(targetId)
  if (!sanitizedPlayerId || !sanitizedTargetId) return null

  const lobbyId = await getPlayerLobbyId(sanitizedPlayerId)
  if (!lobbyId) return null

  const state = await getGameState(lobbyId)
  if (!state || state.phase !== "select_target") return state

  const currentPlayer = state.players[state.currentPlayerIndex]
  if (!currentPlayer || currentPlayer.id !== sanitizedPlayerId) return state

  const target = state.players.find((p) => p.id === sanitizedTargetId && !p.isEliminated)
  if (!target || target.id === currentPlayer.id) return state

  state.targetPlayerId = sanitizedTargetId
  state.lastMessage = `${currentPlayer.name} is targeting ${target.name}...`
  state.version++

  await saveGameState(state.lobbyId, state)
  return state
}

export async function pickCard(playerId: string, cardId: string, targetId?: string): Promise<SharedGameState | null> {
  const sanitizedPlayerId = sanitizeId(playerId)
  if (!sanitizedPlayerId || !cardId) return null

  const lobbyId = await getPlayerLobbyId(sanitizedPlayerId)
  if (!lobbyId) return null

  const state = await getGameState(lobbyId)
  if (!state || (state.phase !== "select_card" && state.phase !== "select_target")) return state

  const currentPlayer = state.players[state.currentPlayerIndex]
  if (!currentPlayer || currentPlayer.id !== sanitizedPlayerId) return state

  if (state.phase === "select_target") {
    if (!targetId) return state
    const sanitizedTargetId = sanitizeId(targetId)
    if (!sanitizedTargetId) return state

    const target = state.players.find((p) => p.id === sanitizedTargetId && !p.isEliminated)
    if (!target || target.id === currentPlayer.id) return state

    state.targetPlayerId = sanitizedTargetId
  }

  return await executeCardPick(state, cardId, currentPlayer)
}

export async function checkTurnTimeout(lobbyId: string): Promise<SharedGameState | null> {
  if (!isValidId(lobbyId)) return null

  const state = await getGameState(lobbyId)
  if (!state) return null

  if (state.phase === "select_target" || state.phase === "select_card") {
    if (state.turnStartTime) {
      const elapsed = Date.now() - state.turnStartTime
      if (elapsed >= TURN_TIMEOUT_MS) {
        return await handleTurnTimeout(state)
      }
    }
  }

  return state
}

async function startNextRound(state: SharedGameState): Promise<SharedGameState> {
  // Reset all players to not eliminated, keep seriesWins
  state.players = state.players.map((p) => ({
    ...p,
    isEliminated: false,
  }))

  // Create fresh cards for all players
  const cards: SharedCard[] = state.players.map((p, idx) => ({
    id: `card-${idx}`,
    ownerId: p.id,
    isRevealed: false,
    position: idx,
  }))

  // Shuffle cards
  state.cards = cards.sort(() => Math.random() - 0.5).map((c, idx) => ({ ...c, position: idx }))

  // Increment round
  state.currentRound++

  const startingPlayerIndex = Math.floor(Math.random() * state.players.length)
  state.currentPlayerIndex = startingPlayerIndex
  state.targetPlayerId = null
  state.phase = "select_target"
  state.turnStartTime = Date.now()
  state.winnerId = null
  state.pendingEliminationId = null
  state.revealResultTime = null
  state.flippingStartTime = null
  state.eliminationAnimationTime = null
  state.roundEndTime = null
  state.roundWinnerId = null
  state.seriesWinnerId = null
  state.winner = null
  // Clear rematch votes for new round
  state.rematchVotes = []
  state.lastMessage = `Round ${state.currentRound} - ${state.players[startingPlayerIndex]?.name}'s turn...`

  state.version++
  await saveGameState(state.lobbyId, state)
  return state
}

async function voteRematch(playerId: string): Promise<SharedGameState | null> {
  const sanitizedPlayerId = sanitizeId(playerId)
  if (!sanitizedPlayerId) return null

  const lobbyId = await getPlayerLobbyId(sanitizedPlayerId)
  if (!lobbyId) return null

  const state = await getGameState(lobbyId)
  if (!state || state.phase !== "series_end") return state

  // Add vote if not already voted
  if (!state.rematchVotes.includes(sanitizedPlayerId)) {
    state.rematchVotes.push(sanitizedPlayerId)
  }

  // Check if all human players have voted
  const humanPlayers = state.players.filter((p) => p.isHuman)
  const allHumansVoted = humanPlayers.every((p) => state.rematchVotes.includes(p.id))

  if (allHumansVoted && humanPlayers.length > 0) {
    // Start a new series - reset everything including seriesWins
    state.players = state.players.map((p) => ({
      ...p,
      isEliminated: false,
      seriesWins: 0,
    }))

    // Create fresh cards
    const cards: SharedCard[] = state.players.map((p, idx) => ({
      id: `card-${idx}`,
      ownerId: p.id,
      isRevealed: false,
      position: idx,
    }))

    state.cards = cards.sort(() => Math.random() - 0.5).map((c, idx) => ({ ...c, position: idx }))
    state.currentRound = 1
    const startingPlayerIndex = Math.floor(Math.random() * state.players.length)
    state.currentPlayerIndex = startingPlayerIndex
    state.targetPlayerId = null
    state.phase = "select_target"
    state.turnStartTime = Date.now()
    state.winnerId = null
    state.pendingEliminationId = null
    state.revealResultTime = null
    state.flippingStartTime = null
    state.eliminationAnimationTime = null
    state.roundEndTime = null
    state.roundWinnerId = null
    state.seriesWinnerId = null
    state.winner = null
    state.rematchVotes = []
    state.lastMessage = `New series begins - ${state.players[startingPlayerIndex]?.name}'s turn...`
  }

  state.version++
  await saveGameState(state.lobbyId, state)
  return state
}

async function getGlobalStats(): Promise<{
  playersOnline: number
  gamesInProgress: number
  playersInQueue: number
}> {
  try {
    // Get all lobby keys
    const lobbyKeys = await redis.keys("lobby:*")
    const playerLobbyKeys = await redis.keys("player:lobby:*")

    let playersOnline = 0
    let gamesInProgress = 0
    let playersInQueue = 0

    // Count unique players and game states
    for (const key of lobbyKeys) {
      if (key.includes(":game:")) continue // Skip game state keys

      try {
        const lobbyData = await redis.get(key)
        if (!lobbyData) continue

        const lobby = typeof lobbyData === "string" ? safeJsonParse(lobbyData, null) : lobbyData
        if (!lobby) continue

        const players =
          typeof lobby.players === "string" ? safeJsonParse(lobby.players, []) : ensureArray(lobby.players)

        const humanPlayers = players.filter((p: { isBot?: boolean }) => !p.isBot).length
        playersOnline += humanPlayers

        if (lobby.status === "playing") {
          gamesInProgress++
        } else if (lobby.status === "waiting") {
          playersInQueue += humanPlayers
        }
      } catch (e) {
        // Skip corrupted lobbies
        continue
      }
    }

    return { playersOnline, gamesInProgress, playersInQueue }
  } catch (error) {
    console.error("[v0] Error getting global stats:", error)
    return { playersOnline: 0, gamesInProgress: 0, playersInQueue: 0 }
  }
}

export async function getSharedGameStateWithReactions(
  playerId: string,
): Promise<{ state: SharedGameState | null; reactions: Record<string, string> }> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) return { state: null, reactions: {} }

  const lobbyId = await getPlayerLobbyId(sanitizedId)
  if (!lobbyId) return { state: null, reactions: {} }

  // Get game state
  const state = await getGameState(lobbyId)
  if (!state) return { state: null, reactions: {} }

  const processedState = await processGameTick(state)

  // Get reactions from lobby (reuses the lobbyId we already have)
  const reactions = await getReactions(lobbyId)

  return { state: processedState, reactions }
}

export const multiplayerService = {
  joinQueue,
  getLobby,
  leaveLobby,
  addReaction,
  getReactions,
  updatePlayerActivity,
  checkDisconnectedPlayers,
  leaveGame,
  finishGame,
  getSharedGameState,
  selectTarget,
  pickCard,
  checkTurnTimeout,
  checkAndTerminateBotOnlyGame,
  voteRematch,
  getGlobalStats,
  getSharedGameStateWithReactions,
  hostPrivateLobby,
  joinByCode,
  hostStartGame,
}

function getNextClockwiseIndex(currentIndex: number, playerCount: number): number {
  const order = playerCount === 4 ? CLOCKWISE_ORDER_4 : CLOCKWISE_ORDER_8
  const currentPosition = order.indexOf(currentIndex)
  const nextPosition = (currentPosition + 1) % order.length
  return order[nextPosition]
}

async function cleanupGameResources(lobbyId: string, playerIds: string[]): Promise<void> {
  const keysToDelete = [
    REDIS_KEYS.LOBBY(lobbyId),
    REDIS_KEYS.GAME_STATE(lobbyId),
    REDIS_KEYS.REACTIONS(lobbyId),
    ...playerIds.map((id) => REDIS_KEYS.PLAYER_ACTIVITY(id)),
    ...playerIds.map((id) => REDIS_KEYS.PLAYER_LOBBY(id)),
  ]

  const batchSize = 10
  for (let i = 0; i < keysToDelete.length; i += batchSize) {
    const batch = keysToDelete.slice(i, i + batchSize)
    await Promise.all(batch.map((key) => redis.del(key)))
  }

  await redis.zrem(REDIS_KEYS.WAITING_LOBBIES, lobbyId)
}

function generateGameCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ" // Excluding I and O to avoid confusion
  let code = ""
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length))
  }
  return code
}

export async function hostPrivateLobby(
  playerId: string,
  roundsToWin = 2,
  maxPlayers = 8,
): Promise<{ player: LobbyPlayer; gameCode: string }> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) {
    throw new Error("Invalid player ID")
  }

  // Check if player is already in a lobby
  const existingLobbyId = await getPlayerLobbyId(sanitizedId)
  if (existingLobbyId) {
    const existingLobby = await getLobbyById(existingLobbyId)
    if (existingLobby) {
      const gameState = await getGameState(existingLobby.id)
      const gameIsFinished =
        gameState?.phase === "game_over" || gameState?.phase === "series_end" || existingLobby.status === "finished"

      if (!gameIsFinished) {
        // Return existing lobby info if it's a private game they're hosting
        if (existingLobby.isPrivate && existingLobby.hostId === sanitizedId && existingLobby.gameCode) {
          const existingPlayer = existingLobby.players.find((p) => p.id === sanitizedId)
          if (existingPlayer) {
            return { player: existingPlayer, gameCode: existingLobby.gameCode }
          }
        }
      }
      await removePlayerLobby(sanitizedId)
    } else {
      await removePlayerLobby(sanitizedId)
    }
  }

  let player = await getPlayerInfo(sanitizedId)
  if (!player) {
    player = createPlayer(sanitizedId)
    await setPlayerInfo(sanitizedId, player)
  } else {
    player.lastActivity = Date.now()
    await setPlayerInfo(sanitizedId, player)
  }

  // Generate unique game code
  let gameCode = generateGameCode()
  let attempts = 0
  while (attempts < 10) {
    const existingLobbyId = await redis.get(REDIS_KEYS.GAME_CODE(gameCode))
    if (!existingLobbyId) break
    gameCode = generateGameCode()
    attempts++
  }

  const lobbyId = `lobby-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const newLobby: Lobby = {
    id: lobbyId,
    players: [player],
    status: "waiting",
    createdAt: Date.now(),
    startTimer: null, // No auto-start timer for private games
    maxPlayers,
    reactions: {},
    roundsToWin,
    isPrivate: true,
    gameCode,
    hostId: sanitizedId,
  }

  await saveLobby(newLobby)
  await setPlayerLobby(sanitizedId, lobbyId)
  // Store game code -> lobby mapping
  await redis.set(REDIS_KEYS.GAME_CODE(gameCode), lobbyId, { ex: REDIS_TTL.LOBBY })

  return { player, gameCode }
}

export async function joinByCode(
  playerId: string,
  gameCode: string,
): Promise<{ success: boolean; player?: LobbyPlayer; error?: string }> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) {
    return { success: false, error: "Invalid player ID" }
  }

  const upperCode = gameCode.toUpperCase().trim()
  if (upperCode.length !== 4) {
    return { success: false, error: "Invalid game code" }
  }

  // Check if player is already in a lobby
  const existingLobbyId = await getPlayerLobbyId(sanitizedId)
  if (existingLobbyId) {
    const existingLobby = await getLobbyById(existingLobbyId)
    if (existingLobby) {
      const gameState = await getGameState(existingLobby.id)
      const gameIsFinished =
        gameState?.phase === "game_over" || gameState?.phase === "series_end" || existingLobby.status === "finished"

      if (!gameIsFinished) {
        // If already in this game, return success
        if (existingLobby.gameCode === upperCode) {
          const existingPlayer = existingLobby.players.find((p) => p.id === sanitizedId)
          if (existingPlayer) {
            return { success: true, player: existingPlayer }
          }
        }
        return { success: false, error: "Already in another game" }
      }
      await removePlayerLobby(sanitizedId)
    } else {
      await removePlayerLobby(sanitizedId)
    }
  }

  // Find lobby by game code
  const lobbyId = await redis.get(REDIS_KEYS.GAME_CODE(upperCode))
  if (!lobbyId || typeof lobbyId !== "string") {
    return { success: false, error: "Game not found" }
  }

  const lobby = await getLobbyById(lobbyId)
  if (!lobby) {
    return { success: false, error: "Game not found" }
  }

  if (lobby.status !== "waiting") {
    return { success: false, error: "Game already started" }
  }

  if (lobby.players.length >= lobby.maxPlayers) {
    return { success: false, error: "Game is full" }
  }

  // Check if already in lobby
  const alreadyIn = lobby.players.some((p) => p.id === sanitizedId)
  if (alreadyIn) {
    const existingPlayer = lobby.players.find((p) => p.id === sanitizedId)
    return { success: true, player: existingPlayer }
  }

  // Get or create player info
  let player = await getPlayerInfo(sanitizedId)
  if (!player) {
    player = createPlayer(sanitizedId)
    await setPlayerInfo(sanitizedId, player)
  } else {
    player.lastActivity = Date.now()
    await setPlayerInfo(sanitizedId, player)
  }

  // Add player to lobby
  lobby.players.push(player)
  await saveLobby(lobby)
  await setPlayerLobby(sanitizedId, lobby.id)

  return { success: true, player }
}

export async function hostStartGame(playerId: string): Promise<{ success: boolean; error?: string }> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) {
    return { success: false, error: "Invalid player ID" }
  }

  const lobbyId = await getPlayerLobbyId(sanitizedId)
  if (!lobbyId) {
    return { success: false, error: "Not in a lobby" }
  }

  const lobby = await getLobbyById(lobbyId)
  if (!lobby) {
    return { success: false, error: "Lobby not found" }
  }

  if (!lobby.isPrivate || lobby.hostId !== sanitizedId) {
    return { success: false, error: "Only host can start the game" }
  }

  if (lobby.status !== "waiting") {
    return { success: false, error: "Game already started" }
  }

  if (lobby.players.length < 2) {
    return { success: false, error: "Need at least 2 players" }
  }

  // Fill remaining slots with bots
  while (lobby.players.length < lobby.maxPlayers) {
    lobby.players.push(generateBot(lobby.players))
  }

  lobby.status = "starting"
  lobby.startTimer = null

  // Clean up game code mapping
  if (lobby.gameCode) {
    await redis.del(REDIS_KEYS.GAME_CODE(lobby.gameCode))
  }

  await initializeGame(lobby, lobby.maxPlayers)
  lobby.status = "in-progress"
  await saveLobby(lobby)

  return { success: true }
}
