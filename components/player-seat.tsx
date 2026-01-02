"use client"

import { useState, useEffect } from "react"
import type { Player } from "@/types/game"
import { ALLOWED_EMOJIS } from "@/types/multiplayer"
import { MessageCircle } from "lucide-react"

interface PlayerSeatProps {
  player: Player
  isActive: boolean
  isTarget: boolean
  canBeTargeted: boolean
  onSelectTarget: (id: string) => void
  displayedEmoji?: string | null
  turnTimeRemaining?: number | null
  seriesWins?: number
  isLocalPlayer?: boolean
  onSendEmoji?: (emoji: string) => void
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
  isLocalPlayer = false,
  onSendEmoji,
}: PlayerSeatProps) {
  const [showEmoji, setShowEmoji] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  useEffect(() => {
    if (displayedEmoji) {
      setShowEmoji(true)
      const timer = setTimeout(() => setShowEmoji(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [displayedEmoji])

  const handleClick = () => {
    if (canBeTargeted && !player.isEliminated) {
      onSelectTarget(player.id)
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    if (onSendEmoji) {
      onSendEmoji(emoji)
    }
    setShowEmojiPicker(false)
  }

  const isClickable = canBeTargeted && !player.isEliminated

  return (
    <div className="relative flex flex-col items-center gap-1 h-[140px] sm:h-[170px] md:h-[200px]">
      {/* Emoji display above avatar */}
      {showEmoji && displayedEmoji && (
        <div className="absolute -top-12 sm:-top-14 left-1/2 -translate-x-1/2 text-4xl sm:text-5xl animate-bounce z-50">
          {displayedEmoji}
        </div>
      )}

      {showEmojiPicker && isLocalPlayer && (
        <div className="absolute -top-20 sm:-top-24 left-1/2 -translate-x-1/2 z-50 bg-black/95 border border-amber-900/50 rounded-xl p-2 shadow-xl">
          <div className="flex gap-1 flex-wrap max-w-[180px] justify-center">
            {ALLOWED_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation()
                  handleEmojiSelect(emoji)
                }}
                className="text-2xl hover:scale-125 transition-transform p-1 hover:bg-amber-900/30 rounded"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Avatar button for targeting */}
      <button
        onClick={handleClick}
        disabled={!isClickable}
        className={`
          relative flex flex-col items-center transition-all duration-500
          ${isClickable ? "cursor-pointer" : "cursor-default"}
          ${player.isEliminated ? "opacity-30 grayscale" : ""}
        `}
      >
        <div className="relative">
          <div
            className={`
            relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full overflow-hidden
            border-3 sm:border-4 transition-all duration-500
            ${isActive ? "border-amber-500 shadow-[0_0_25px_rgba(217,119,6,0.7)] scale-110" : "border-amber-900/50"}
            ${isTarget ? "border-red-600 shadow-[0_0_25px_rgba(220,38,38,0.7)]" : ""}
            ${isClickable ? "hover:border-amber-400 hover:scale-105 hover:shadow-[0_0_20px_rgba(217,119,6,0.5)]" : ""}
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
          {isClickable && (
            <div className="absolute inset-0 rounded-full border-2 border-amber-400/50 animate-pulse"></div>
          )}

          {seriesWins > 0 && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
              {Array.from({ length: seriesWins }).map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300 shadow-[0_0_8px_rgba(217,119,6,0.6)]"
                  title={`Round ${i + 1} Win`}
                />
              ))}
            </div>
          )}
        </div>
      </button>

      {/* Player name and timer */}
      <div className="flex flex-col items-center min-h-[2.5rem] sm:min-h-[3rem] mt-2 sm:mt-3">
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

      {isLocalPlayer && !player.isEliminated && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowEmojiPicker(!showEmojiPicker)
          }}
          className="mt-1 p-2 rounded-full bg-amber-900/30 border border-amber-700/50 hover:bg-amber-800/50 hover:border-amber-600/70 transition-all hover:scale-110 active:scale-95"
          title="Send emoji"
        >
          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
        </button>
      )}
    </div>
  )
}
