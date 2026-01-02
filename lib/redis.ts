import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Key prefixes for Redis
export const REDIS_KEYS = {
  LOBBY: "lobby:",
  PLAYER_LOBBY: "player:lobby:",
  PLAYER_INFO: "player:info:",
  WAITING_LOBBIES: "waiting:lobbies",
  REACTIONS: "reactions:",
} as const

// TTL for Redis keys (1 hour)
export const REDIS_TTL = 3600

export const kv = redis
