"use client"

import { useState, useEffect } from "react"
import { getGlobalStats } from "@/app/actions/multiplayer"

interface Stats {
  playersOnline: number
  gamesInProgress: number
  playersInQueue: number
}

interface LiveStatsProps {
  compact?: boolean
}

export default function LiveStats({ compact = false }: LiveStatsProps) {
  const [stats, setStats] = useState<Stats>({ playersOnline: 0, gamesInProgress: 0, playersInQueue: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getGlobalStats()
        setStats(data)
      } catch (error) {
        console.error("[v0] Error fetching stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-4 sm:gap-6 text-amber-200/60">
        <div className="animate-pulse flex gap-4 sm:gap-6">
          <div className="h-3 w-16 bg-amber-900/30 rounded" />
          <div className="h-3 w-16 bg-amber-900/30 rounded" />
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="text-amber-200/70">
            <span className="font-bold text-amber-300">{stats.playersOnline}</span> online
          </span>
        </div>
        <div className="text-amber-200/40">|</div>
        <div className="text-amber-200/70">
          <span className="font-bold text-amber-300">{stats.gamesInProgress}</span> games
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-8 text-sm">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-amber-200/80">
          <span className="font-bold text-amber-300">{stats.playersOnline}</span> online
        </span>
      </div>
      <div className="text-amber-200/60">|</div>
      <div className="text-amber-200/80">
        <span className="font-bold text-amber-300">{stats.gamesInProgress}</span> games live
      </div>
      {stats.playersInQueue > 0 && (
        <>
          <div className="text-amber-200/60">|</div>
          <div className="text-amber-200/80">
            <span className="font-bold text-amber-300">{stats.playersInQueue}</span> in queue
          </div>
        </>
      )}
    </div>
  )
}
