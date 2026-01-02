"use client"

import { useState, useEffect } from "react"
import type { Player } from "@/types/game"

interface PlayerSeatProps {
  player: Player
  isActive: boolean
  isTarget: boolean
  canBeTargeted: boolean
  onSelectTarget: (id: string) => void
  displayedEmoji?: string | null
  turnTimeRemaining?: number | null
  seriesWins?: number
}

export default function PlayerSeat({
  player,
  isActive,
  isTarget,
  canBeTargeted,
  onSelectTarget,
  displayedEmoji,
  turnTimeRemaining,
  seriesWins = 0,
}: PlayerSeatProps) {
  const [showEmoji, setShowEmoji] = useState(false)

  useEffect(() => {
    if (displayedEmoji) {
      setShowEmoji(true)
      const timer = setTimeout(() => setShowEmoji(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [displayedEmoji])

  return (
    <button
      onClick={() => canBeTargeted && onSelectTarget(player.id)}
      disabled={!canBeTargeted || player.isEliminated}
      className={`
        relative flex flex-col items-center gap-1 transition-all duration-500
        ${canBeTargeted && !player.isEliminated ? "cursor-pointer" : "cursor-default"}
        ${player.isEliminated ? "opacity-30 grayscale" : ""}
      `}
    >
      {showEmoji && displayedEmoji && (
        <div className="absolute -top-12 sm:-top-14 left-1/2 -translate-x-1/2 text-4xl sm:text-5xl animate-bounce z-50">
          {displayedEmoji}
        </div>
      )}
      <div className="relative">
        <div
          className={`
          relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full overflow-hidden
          border-3 sm:border-4 transition-all duration-500
          ${isActive ? "border-amber-500 shadow-[0_0_25px_rgba(217,119,6,0.7)] scale-110" : "border-amber-900/50"}
          ${isTarget ? "border-red-600 shadow-[0_0_25px_rgba(220,38,38,0.7)]" : ""}
          ${canBeTargeted && !player.isEliminated ? "hover:border-amber-400 hover:scale-105" : ""}
        `}
        >
          <img src={player.avatar || "/placeholder.svg"} alt={player.name} className="w-full h-full object-cover" />
          {player.isEliminated && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <span className="text-red-600 text-4xl sm:text-5xl font-bold">✕</span>
            </div>
          )}
        </div>
        {isActive && (
          <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(217,119,6,0.9)]"></div>
        )}
      </div>
      {/* Series Win Tokens */}
      {seriesWins > 0 && (
        <div className="flex gap-1 mt-1">
          {Array.from({ length: seriesWins }).map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300 shadow-[0_0_8px_rgba(217,119,6,0.6)]"
              title={`Round ${i + 1} Win`}
            />
          ))}
        </div>
      )}
      <div className="flex flex-col items-center min-h-[2.5rem] sm:min-h-[3rem]">
        <span
          className={`
          font-serif text-sm sm:text-base md:text-lg tracking-wider uppercase font-bold whitespace-nowrap
          ${isActive ? "text-amber-400" : "text-amber-700"}
          ${isTarget ? "text-red-500" : ""}
        `}
        >
          {player.name}
        </span>
        <span
          className={`
            font-mono text-xs sm:text-sm font-bold h-4 sm:h-5
            ${
              isActive && turnTimeRemaining !== null && turnTimeRemaining !== undefined && !player.isEliminated
                ? turnTimeRemaining <= 5
                  ? "text-red-500 animate-pulse"
                  : "text-amber-500"
                : "invisible"
            }
          `}
        >
          {isActive && turnTimeRemaining !== null && turnTimeRemaining !== undefined ? `${turnTimeRemaining}s` : "0s"}
        </span>
      </div>
    </button>
  )
}
