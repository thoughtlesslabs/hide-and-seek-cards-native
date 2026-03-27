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
  GAME_CODE: (code: string) => `gamecode:${code}`,
} as const

// TTL for Redis keys
export const REDIS_TTL = {
  LOBBY: 1800,
  PLAYER_MAPPING: 1800,
  GAME_STATE: 1800,
} as const

export async function flushAllGameData(): Promise<{ success: boolean; message: string }> {
  try {
    // Use FLUSHDB command directly instead of iterating keys
    await redis.flushdb()
    return { success: true, message: "Database flushed successfully" }
  } catch (error) {
    console.log("[v0] Flush error:", error)
    return { success: false, message: String(error) }
  }
}

export async function safeGet<T>(key: string): Promise<T | null> {
  try {
    const result = await redis.get(key)
    return result as T | null
  } catch (error) {
    console.log(`[v0] Safe get error for ${key}:`, error)
    return null
  }
}

export async function safeSet(key: string, value: unknown, ttl?: number): Promise<boolean> {
  try {
    if (ttl) {
      await redis.set(key, value, { ex: ttl })
    } else {
      await redis.set(key, value)
    }
    return true
  } catch (error) {
    console.log(`[v0] Safe set error for ${key}:`, error)
    return false
  }
}

export async function safeDel(...keys: string[]): Promise<boolean> {
  try {
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    return true
  } catch (error) {
    console.log(`[v0] Safe del error:`, error)
    return false
  }
}
