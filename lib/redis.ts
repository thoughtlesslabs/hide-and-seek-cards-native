import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Key prefixes for Redis
export const REDIS_KEYS = {
  LOBBY: "lobby:", // lobby:{lobbyId} -> Lobby object
  PLAYER_LOBBY: "player:lobby:", // player:lobby:{odId} -> lobbyId
  PLAYER_INFO: "player:info:", // player:info:{playerId} -> LobbyPlayer object
  WAITING_LOBBIES: "waiting:lobbies", // Sorted set of waiting lobbies by creation time
  REACTIONS: "reactions:", // reactions:{lobbyId} -> list of reactions
} as const

// TTL for Redis keys (1 hour)
export const REDIS_TTL = 3600
