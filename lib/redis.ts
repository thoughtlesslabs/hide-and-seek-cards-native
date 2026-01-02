import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Key prefixes for Redis
export const REDIS_KEYS = {
  LOBBY: (id: string) => `lobby:${id}`,
  PLAYER_LOBBY: (id: string) => `player:lobby:${id}`,
  PLAYER_INFO: (id: string) => `player:info:${id}`,
  WAITING_LOBBIES: "lobbies:waiting",
  GAME_STATE: (id: string) => `game:state:${id}`,
} as const

// TTL for Redis keys
export const REDIS_TTL = {
  LOBBY: 1800,
  PLAYER_MAPPING: 1800,
  GAME_STATE: 1800,
} as const

export async function flushAllGameData(): Promise<{ success: boolean; message: string }> {
  try {
    const patterns = ["lobby:*", "player:*", "game:*", "lobbies:*", "reactions:*"]
    let deletedCount = 0

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
        deletedCount += keys.length
      }
    }

    return { success: true, message: `Deleted ${deletedCount} keys` }
  } catch (error) {
    return { success: false, message: String(error) }
  }
}
