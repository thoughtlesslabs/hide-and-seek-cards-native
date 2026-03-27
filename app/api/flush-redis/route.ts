import { NextResponse } from "next/server"
import { redis } from "@/lib/redis"

export async function POST() {
  try {
    await redis.flushdb()
    return NextResponse.json({ success: true, message: "Database flushed successfully" })
  } catch (error) {
    return NextResponse.json({ success: false, message: String(error) })
  }
}

export async function GET() {
  try {
    await redis.flushdb()
    return NextResponse.json({ success: true, message: "Database flushed successfully" })
  } catch (error) {
    return NextResponse.json({ success: false, message: String(error) })
  }
}
