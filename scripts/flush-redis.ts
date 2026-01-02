import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

async function flushAllGameData() {
  console.log("=== FLUSHING ALL REDIS DATA ===")

  try {
    const keys = await redis.keys("*")
    console.log(`Found ${keys.length} keys to delete`)

    if (keys.length > 0) {
      for (const key of keys) {
        await redis.del(key)
        console.log(`Deleted: ${key}`)
      }
      console.log(`\nSuccessfully deleted ${keys.length} keys`)
    } else {
      console.log("No keys found - Redis is already empty")
    }

    console.log("\n=== REDIS FLUSH COMPLETE ===")
    console.log("You can now refresh the app to start fresh!")
  } catch (error) {
    console.error("Error flushing Redis:", error)
  }
}

flushAllGameData()
