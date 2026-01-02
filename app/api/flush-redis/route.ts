import { flushAllGameData } from "@/lib/redis"
import { NextResponse } from "next/server"

export async function POST() {
  const result = await flushAllGameData()
  return NextResponse.json(result)
}

export async function GET() {
  const result = await flushAllGameData()
  return NextResponse.json(result)
}
