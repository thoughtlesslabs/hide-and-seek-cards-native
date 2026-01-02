import { Redis } from "@upstash/redis"
import type { Lobby, LobbyPlayer, SharedGameState, SharedPlayer, SharedCard } from "@/types/multiplayer"
import { generateUsername } from "./username-generator"

const redis = Redis.fromEnv()

const MAX_PLAYERS = 4
const LOBBY_TIMER_MS = 30000
const TURN_TIMEOUT_MS = 15000
const DISCONNECT_TIMEOUT_MS = 15000
const GAME_START_DELAY_MS = 3000
const BOT_NAMES = ["Silas", "Morgana", "Thorne", "Valeria", "Corvus", "Nyx"]
const BOT_THINKING_DELAY_MS = 2000
const REVEAL_RESULT_DURATION_MS = 4000
const ELIMINATION_ANIMATION_DURATION_MS = 2000
const FLIP_ANIMATION_DURATION_MS = 800

const COUNTER_CLOCKWISE_ORDER = [0, 2, 1, 3]

function getNextClockwiseIndex(currentIndex: number): number {
  const currentPosition = COUNTER_CLOCKWISE_ORDER.indexOf(currentIndex)
  const nextPosition = (currentPosition + 1) % COUNTER_CLOCKWISE_ORDER.length
  return COUNTER_CLOCKWISE_ORDER[nextPosition]
}

const REDIS_TTL = {
  LOBBY: 1800,
  GAME: 1800,
  PLAYER_MAPPING: 1800,
  ACTIVITY: 60,
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

function generateBot(): LobbyPlayer {
  const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]
  return {
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: botName,
    isBot: true,
    isReady: true,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${botName.toLowerCase()}`,
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
    ...playerIds.map((id) => REDIS_KEYS.PLAYER_LOBBY(id)),
    ...playerIds.map((id) => REDIS_KEYS.PLAYER_ACTIVITY(id)),
  ]

  const batchSize = 10
  for (let i = 0; i < keysToDelete.length; i += batchSize) {
    const batch = keysToDelete.slice(i, i + batchSize)
    await Promise.all(batch.map((key) => redis.del(key)))
  }

  await redis.zrem(REDIS_KEYS.WAITING_LOBBIES, lobbyId)
}

async function initializeGame(lobby: Lobby): Promise<SharedGameState> {
  const players: SharedPlayer[] = lobby.players.map((p, idx) => ({
    id: p.id,
    name: p.username,
    isHuman: !p.isBot,
    isEliminated: false,
    cardValue: idx,
    avatar: p.avatar,
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
    phase: "waiting",
    lastMessage: "The shadows gather...",
    winner: null,
    winnerId: null,
    turnStartTime: null,
    lastMoveBy: null,
    lastMoveTime: null,
    version: 1,
    gameStartTime: Date.now(),
    pendingEliminationId: null,
    revealResultTime: null,
    eliminationAnimationTime: null,
    flippingStartTime: null,
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
      lobby.players.push(generateBot())
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

export async function joinQueue(playerId: string): Promise<LobbyPlayer> {
  const sanitizedId = sanitizeId(playerId)
  if (!sanitizedId) {
    throw new Error("Invalid player ID")
  }

  const existingLobbyId = await getPlayerLobbyId(sanitizedId)
  if (existingLobbyId) {
    const existingLobby = await getLobbyById(existingLobbyId)
    if (existingLobby) {
      const gameState = await getGameState(existingLobby.id)
      const gameIsFinished = gameState?.phase === "game_over" || existingLobby.status === "finished"

      if (!gameIsFinished) {
        const existingPlayer = existingLobby.players.find((p) => p.id === sanitizedId)
        if (existingPlayer) {
          return existingPlayer
        }
      }
      await cleanupGameResources(
        existingLobby.id,
        existingLobby.players.map((p) => p.id),
      )
    }
    await removePlayerLobby(sanitizedId)
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
    if (lobby && lobby.status === "waiting" && lobby.players.length < MAX_PLAYERS) {
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

  const disconnected: string[] = []
  const now = Date.now()

  for (const player of state.players) {
    if (!player.isHuman || player.isEliminated) continue

    const lastActivity = await redis.get(REDIS_KEYS.PLAYER_ACTIVITY(player.id))
    const activityTime = lastActivity ? Number.parseInt(lastActivity as string) : 0

    if (now - activityTime > DISCONNECT_TIMEOUT_MS) {
      player.isHuman = false
      player.name = `${player.name} (Bot)`
      disconnected.push(player.id)
    }
  }

  if (disconnected.length > 0) {
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

  // Handle waiting phase countdown
  if (state.phase === "waiting" && state.gameStartTime) {
    const elapsed = now - state.gameStartTime
    if (elapsed >= GAME_START_DELAY_MS) {
      state.phase = "select_target"
      state.turnStartTime = now
      const currentPlayer = state.players[state.currentPlayerIndex]
      state.lastMessage = `${currentPlayer?.name}'s turn to choose a target...`
      state.version++
      await saveGameState(state)
    }
    return state
  }

  // Handle reveal result phase
  if (state.phase === "reveal_result" && state.revealResultTime) {
    const elapsed = now - state.revealResultTime
    if (elapsed >= REVEAL_RESULT_DURATION_MS) {
      return await processAfterReveal(state)
    }
    return state
  }

  if (state.phase === "flipping" && state.flippingStartTime) {
    const elapsed = now - state.flippingStartTime
    if (elapsed >= FLIP_ANIMATION_DURATION_MS) {
      return await processAfterFlipping(state)
    }
    return state
  }

  // Handle elimination animation phase
  if (state.phase === "elimination_animation" && state.eliminationAnimationTime) {
    const elapsed = now - state.eliminationAnimationTime
    if (elapsed >= ELIMINATION_ANIMATION_DURATION_MS) {
      return await processAfterElimination(state)
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

  // Move to next player
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
  state.turnStartTime = Date.now()
  state.flippingStartTime = null

  const nextPlayer = state.players[nextIndex]
  state.lastMessage = `${nextPlayer?.name}'s turn to choose a target...`

  state.version++
  await saveGameState(state)
  return state
}

async function processAfterElimination(state: SharedGameState): Promise<SharedGameState> {
  const activePlayers = state.players.filter((p) => !p.isEliminated)

  if (activePlayers.length <= 1) {
    const winner = activePlayers[0]
    state.phase = "game_over"
    state.winner = winner?.name || "No one"
    state.winnerId = winner?.id || null
    state.lastMessage = winner ? `${winner.name} is the last one standing!` : "No survivors..."
    state.pendingEliminationId = null
    state.eliminationAnimationTime = null
    state.version++
    await saveGameState(state)
    return state
  }

  // Go to flipping phase before shuffle
  state.phase = "flipping"
  state.flippingStartTime = Date.now()
  state.pendingEliminationId = null
  state.eliminationAnimationTime = null

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
}
