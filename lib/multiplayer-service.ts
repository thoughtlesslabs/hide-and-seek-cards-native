import { Redis } from "@upstash/redis"
import type { Lobby, LobbyPlayer, SharedGameState, SharedPlayer, SharedCard } from "@/types/multiplayer"
import { generateUsername } from "./username-generator"

const redis = Redis.fromEnv()

const MAX_PLAYERS = 4
const LOBBY_TIMER_MS = 30000
const TURN_TIMEOUT_MS = 15000
const DISCONNECT_TIMEOUT_MS = 60000
const GAME_START_DELAY_MS = 3000
const BOT_NAMES = ["Silas", "Morgana", "Thorne", "Valeria", "Corvus", "Nyx"]
const BOT_AVATAR_SEEDS = ["mystic", "shadow", "ember", "frost", "storm", "void"]
const BOT_THINKING_DELAY_MS = 2000
const REVEAL_RESULT_DURATION_MS = 4000
const ELIMINATION_ANIMATION_DURATION_MS = 2000
const FLIP_ANIMATION_DURATION_MS = 800
const ROUND_END_DELAY_MS = 3000
const COUNTER_CLOCKWISE_ORDER = [0, 2, 1, 3]
const DEALING_ANIMATION_DURATION_MS = 1500
const SHUFFLING_ANIMATION_DURATION_MS = 800

function getNextClockwiseIndex(currentIndex: number): number {
  const currentPosition = COUNTER_CLOCKWISE_ORDER.indexOf(currentIndex)
  const nextPosition = (currentPosition + 1) % COUNTER_CLOCKWISE_ORDER.length
  return COUNTER_CLOCKWISE_ORDER[nextPosition]
}

const REDIS_TTL = {
  LOBBY: 1800,
  GAME: 1800,
  PLAYER_MAPPING: 1800,
  ACTIVITY: 120,
  PLAYER_INFO: 86400,
  REACTIONS: 60,
}

const REDIS_KEYS = {
  LOBBY: (id: string) => `lobby:${id}`,
  PLAYER_LOBBY: (id: string) => `player:lobby:${id}`,
  PLAYER_INFO: (id: string) => `player:info:${id}`,
  GAME_STATE: (lobbyId: string) => `game:state:${lobbyId}`,
  WAITING_LOBBIES: "lobbies:waiting",
  PLAYER_ACTIVITY: (id: string) => `player:activity:${id}`,
  REACTIONS: (lobbyId: string) => `reactions:${lobbyId}`,
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
    // Fallback if all names used (shouldn't happen with 4 max players)
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
  const lobbyData = {
    ...lobby,
    players: JSON.stringify(lobby.players),
    reactions: JSON.stringify(lobby.reactions),
  }
  await redis.set(REDIS_KEYS.LOBBY(lobby.id), JSON.stringify(lobbyData), { ex: REDIS_TTL.LOBBY })
}

async function getLobbyById(lobbyId: string): Promise<Lobby | null> {
  if (!isValidId(lobbyId)) return null

  const data = await redis.get(REDIS_KEYS.LOBBY(lobbyId))
  if (!data) return null

  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data
    const players = typeof parsed.players === "string" ? JSON.parse(parsed.players) : parsed.players
    const reactions = typeof parsed.reactions === "string" ? JSON.parse(parsed.reactions) : parsed.reactions
    return {
      ...parsed,
      players: Array.isArray(players) ? players : [],
      reactions: reactions || {},
    }
  } catch {
    return null
  }
}

async function getPlayerLobbyId(playerId: string): Promise<string | null> {
  if (!isValidId(playerId)) return null
  const lobbyId = await redis.get(REDIS_KEYS.PLAYER_LOBBY(playerId))
  return lobbyId as string | null
}

async function setPlayerLobby(playerId: string, lobbyId: string): Promise<void> {
  await redis.set(REDIS_KEYS.PLAYER_LOBBY(playerId), lobbyId, { ex: REDIS_TTL.PLAYER_MAPPING })
}

async function removePlayerLobby(playerId: string): Promise<void> {
  await redis.del(REDIS_KEYS.PLAYER_LOBBY(playerId))
}

async function getPlayerInfo(playerId: string): Promise<LobbyPlayer | null> {
  if (!isValidId(playerId)) return null
  const data = await redis.get(REDIS_KEYS.PLAYER_INFO(playerId))
  if (!data) return null
  try {
    return typeof data === "string" ? JSON.parse(data) : (data as LobbyPlayer)
  } catch {
    return null
  }
}

async function savePlayerInfo(player: LobbyPlayer): Promise<void> {
  await redis.set(REDIS_KEYS.PLAYER_INFO(player.id), JSON.stringify(player), { ex: REDIS_TTL.PLAYER_INFO })
}

async function saveGameState(state: SharedGameState): Promise<void> {
  const stateData = {
    ...state,
    players: JSON.stringify(state.players),
    cards: JSON.stringify(state.cards),
  }
  await redis.set(REDIS_KEYS.GAME_STATE(state.lobbyId), JSON.stringify(stateData), { ex: REDIS_TTL.GAME })
}

async function getGameState(lobbyId: string): Promise<SharedGameState | null> {
  if (!isValidId(lobbyId)) return null
  const data = await redis.get(REDIS_KEYS.GAME_STATE(lobbyId))
  if (!data) return null

  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data
    const players = typeof parsed.players === "string" ? JSON.parse(parsed.players) : parsed.players
    const cards = typeof parsed.cards === "string" ? JSON.parse(parsed.cards) : parsed.cards

    return {
      ...parsed,
      players: Array.isArray(players) ? players : [],
      cards: Array.isArray(cards) ? cards : [],
    }
  } catch {
    return null
  }
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

export async function initializeGame(lobby: Lobby): Promise<SharedGameState> {
  const players: SharedPlayer[] = lobby.players.map((p, idx) => ({
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
  const startingPlayerIndex = getNextClockwiseIndex(0)

  const state: SharedGameState = {
    lobbyId: lobby.id,
    players,
    cards: shuffledCards,
    currentPlayerIndex: startingPlayerIndex,
    targetPlayerId: null,
    phase: "dealing",
    lastMessage: "Dealing cards...",
    winnerId: null,
    turnStartTime: null,
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
    dealingStartTime: Date.now(),
    shufflingStartTime: null,
  }
  await saveGameState(state)
  return state
}

async function checkAndHandleLobbyTimer(lobby: Lobby): Promise<Lobby> {
  if (lobby.status !== "waiting") return lobby

  const now = Date.now()
  const timerExpired = lobby.startTimer && now >= lobby.startTimer

  if (timerExpired && lobby.players.length > 0) {
    while (lobby.players.length < MAX_PLAYERS) {
      lobby.players.push(generateBot(lobby.players))
    }

    lobby.status = "starting"
    lobby.startTimer = null

    await redis.zrem(REDIS_KEYS.WAITING_LOBBIES, lobby.id)
    await initializeGame(lobby)
    lobby.status = "in-progress"
    await saveLobby(lobby)
  }

  return lobby
}

export async function joinQueue(playerId: string, roundsToWin = 2): Promise<LobbyPlayer> {
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
      // Game is finished, clean up the player's lobby mapping
      await removePlayerLobby(sanitizedId)
    } else {
      // Lobby doesn't exist anymore, clean up
      await removePlayerLobby(sanitizedId)
    }
  }

  let player = await getPlayerInfo(sanitizedId)
  if (!player) {
    player = createPlayer(sanitizedId)
    await savePlayerInfo(player)
  } else {
    player.lastActivity = Date.now()
    await savePlayerInfo(player)
  }

  const waitingLobbyIds = await redis.zrange(REDIS_KEYS.WAITING_LOBBIES, 0, -1)

  for (const lobbyId of waitingLobbyIds) {
    const lobby = await getLobbyById(lobbyId as string)
    if (
      lobby &&
      lobby.status === "waiting" &&
      lobby.players.length < MAX_PLAYERS &&
      lobby.roundsToWin === roundsToWin
    ) {
      const alreadyInLobby = lobby.players.some((p) => p.id === sanitizedId)
      if (alreadyInLobby) continue

      lobby.players.push(player)
      await setPlayerLobby(sanitizedId, lobby.id)

      if (lobby.players.length >= MAX_PLAYERS) {
        lobby.status = "starting"
        lobby.startTimer = null
        await redis.zrem(REDIS_KEYS.WAITING_LOBBIES, lobby.id)
        await initializeGame(lobby)
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
    maxPlayers: MAX_PLAYERS,
    reactions: {},
    roundsToWin,
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

  lobby = await checkAndHandleLobbyTimer(lobby)
  return lobby
}

export async function leaveLobby(playerId: string): Promise<void> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) return

  const lobbyId = await getPlayerLobbyId(sanitizedId)
  if (!lobbyId) return

  const lobby = await getLobbyById(lobbyId)
  if (!lobby) {
    await removePlayerLobby(sanitizedId)
    return
  }

  if (lobby.status === "waiting") {
    lobby.players = lobby.players.filter((p) => p.id !== sanitizedId)
    await removePlayerLobby(sanitizedId)

    if (lobby.players.length === 0) {
      await redis.del(REDIS_KEYS.LOBBY(lobbyId))
      await redis.zrem(REDIS_KEYS.WAITING_LOBBIES, lobbyId)
    } else {
      await saveLobby(lobby)
    }
  }
}

export async function addReaction(playerId: string, emoji: string): Promise<void> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) return

  const lobbyId = await getPlayerLobbyId(sanitizedId)
  if (!lobbyId) return

  const allowedEmojis = ["👍", "😄", "😮", "😢", "😡", "👏", "🎉", "🤔"]
  if (!allowedEmojis.includes(emoji)) return

  const lobby = await getLobbyById(lobbyId)
  if (!lobby) return

  const reactions = lobby.reactions || {}
  reactions[sanitizedId] = { emoji, timestamp: Date.now() }
  lobby.reactions = reactions

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
    await saveGameState(state)
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
    await saveGameState(state)
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

  // Handle dealing phase countdown
  if (state.phase === "dealing" && state.dealingStartTime) {
    const elapsed = now - state.dealingStartTime
    if (elapsed >= DEALING_ANIMATION_DURATION_MS) {
      state.phase = "select_target"
      state.turnStartTime = now
      state.dealingStartTime = null
      const currentPlayer = state.players[state.currentPlayerIndex]
      state.lastMessage = `${currentPlayer?.name}'s turn to choose a target...`
      state.version++
      await saveGameState(state)
    }
    return state
  }

  if (state.phase === "shuffling" && state.shufflingStartTime) {
    const elapsed = now - state.shufflingStartTime
    if (elapsed >= SHUFFLING_ANIMATION_DURATION_MS) {
      const currentIndex = state.currentPlayerIndex
      let nextIndex = getNextClockwiseIndex(currentIndex)
      let attempts = 0
      while (state.players[nextIndex]?.isEliminated && attempts < state.players.length) {
        nextIndex = getNextClockwiseIndex(nextIndex)
        attempts++
      }

      state.currentPlayerIndex = nextIndex
      state.targetPlayerId = null
      state.phase = "select_target"
      state.turnStartTime = now
      state.shufflingStartTime = null

      const nextPlayer = state.players[nextIndex]
      state.lastMessage = `${nextPlayer?.name}'s turn to choose a target...`

      state.version++
      await saveGameState(state)
    }
    return state
  }

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
    state.phase === "elimination_animation" ||
    state.phase === "dealing" ||
    state.phase === "shuffling"
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
  await saveGameState(state)
  return state
}

async function processAfterFlipping(state: SharedGameState): Promise<SharedGameState> {
  // Shuffle cards
  for (let i = state.cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[state.cards[i], state.cards[j]] = [state.cards[j], state.cards[i]]
  }
  state.cards = state.cards.map((c, idx) => ({ ...c, position: idx }))

  state.phase = "shuffling"
  state.shufflingStartTime = Date.now()
  state.flippingStartTime = null
  state.lastMessage = "Shuffling cards..."

  state.version++
  await saveGameState(state)
  return state
}

async function processAfterElimination(state: SharedGameState): Promise<SharedGameState> {
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
    await saveGameState(state)
    return state
  }

  state.phase = "shuffling"
  state.shufflingStartTime = Date.now()
  state.flippingStartTime = null
  state.lastMessage = "Shuffling cards..."

  state.version++
  await saveGameState(state)
  return state
}

async function processAfterRoundEnd(state: SharedGameState): Promise<SharedGameState> {
  // Reset game state for a new round
  state.phase = "waiting"
  state.gameStartTime = Date.now()
  state.lastMessage = "The shadows gather for a new round..."
  state.version++
  await saveGameState(state)
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
      await saveGameState(state)
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
      await saveGameState(state)
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

  await saveGameState(state)
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

  await saveGameState(state)
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
    id: `card-${idx}-r${state.currentRound + 1}`,
    ownerId: p.id,
    isRevealed: false,
    position: idx,
  }))

  // Shuffle cards
  state.cards = cards.sort(() => Math.random() - 0.5).map((c, idx) => ({ ...c, position: idx }))

  // Increment round
  state.currentRound++

  // Reset game state for new round
  state.currentPlayerIndex = getNextClockwiseIndex(0)
  state.targetPlayerId = null
  state.phase = "waiting"
  state.gameStartTime = Date.now()
  state.turnStartTime = null
  state.pendingEliminationId = null
  state.revealResultTime = null
  state.flippingStartTime = null
  state.eliminationAnimationTime = null
  state.roundEndTime = null
  state.roundWinnerId = null
  state.winner = null
  state.winnerId = null
  state.lastMessage = `Round ${state.currentRound} begins...`

  state.version++
  await saveGameState(state)
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
      id: `card-${idx}-rematch`,
      ownerId: p.id,
      isRevealed: false,
      position: idx,
    }))

    state.cards = cards.sort(() => Math.random() - 0.5).map((c, idx) => ({ ...c, position: idx }))
    state.currentRound = 1
    state.currentPlayerIndex = getNextClockwiseIndex(0)
    state.targetPlayerId = null
    state.phase = "waiting"
    state.gameStartTime = Date.now()
    state.turnStartTime = null
    state.pendingEliminationId = null
    state.revealResultTime = null
    state.flippingStartTime = null
    state.eliminationAnimationTime = null
    state.roundEndTime = null
    state.roundWinnerId = null
    state.seriesWinnerId = null
    state.winner = null
    state.winnerId = null
    state.rematchVotes = []
    state.lastMessage = "New series begins..."
  }

  state.version++
  await saveGameState(state)
  return state
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
}
