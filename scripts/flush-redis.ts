import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

async function flushAllGameData() {
  console.log("Flushing all game data from Redis...")

  const keys = await redis.keys("*")
  console.log(`Found ${keys.length} keys`)

  if (keys.length > 0) {
    await redis.del(...keys)
    console.log("All keys deleted successfully")
  }

  console.log("Done! Redis is now clean for the new best-of-3 series and private game features.")
}

flushAllGameData().catch(console.error)
