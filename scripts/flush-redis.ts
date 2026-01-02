import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

async function flushAllGameData() {
  console.log("Flushing all game data from Redis...")

  // Get all keys
  const keys = await redis.keys("*")
  console.log(`Found ${keys.length} keys`)

  if (keys.length > 0) {
    // Delete all keys
    await redis.del(...keys)
    console.log("All keys deleted")
  }

  console.log("Done! Redis is now clean.")
}

flushAllGameData().catch(console.error)
