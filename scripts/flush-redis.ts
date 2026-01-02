import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

async function flushAllGameData() {
  console.log("=== Flushing all game data from Redis ===")
  console.log("")

  const keys = await redis.keys("*")
  console.log(`Found ${keys.length} keys to delete`)

  if (keys.length > 0) {
    // Delete in batches to avoid issues
    const batchSize = 50
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize)
      await redis.del(...batch)
      console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}`)
    }
    console.log("")
    console.log("All keys deleted successfully!")
  } else {
    console.log("Redis is already empty")
  }

  console.log("")
  console.log("=== Done! Redis is now clean ===")
  console.log("You can now start a fresh game with the new best-of-3 series features.")
}

flushAllGameData().catch(console.error)
