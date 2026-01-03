"use client"

import { useState, useEffect, useRef } from "react"
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
  size?: "normal" | "small"
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
  size = "normal",
}: PlayerSeatProps) {
  const [showEmoji, setShowEmoji] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (displayedEmoji) {
      setShowEmoji(true)
      const timer = setTimeout(() => setShowEmoji(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [displayedEmoji])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
      }
    }

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showEmojiPicker])

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

  const isSmall = size === "small"
  const containerHeight = isSmall ? "h-[120px] sm:h-[140px] md:h-[160px]" : "h-[150px] sm:h-[180px] md:h-[210px]"
  const avatarSize = isSmall ? "w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20" : "w-18 h-18 sm:w-22 sm:h-22 md:w-24 md:h-24"
  const textSize = isSmall ? "text-[10px] sm:text-xs" : "text-xs sm:text-sm"
  const eliminatedX = isSmall ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl"
  const winTokenSize = isSmall ? "w-2.5 h-2.5 sm:w-3 sm:h-3" : "w-3 h-3 sm:w-4 sm:h-4"
  const emojiSize = isSmall ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl"
  const emojiTop = isSmall ? "-top-6 sm:-top-8" : "-top-12 sm:-top-14"

  const showTimer = isActive && turnTimeRemaining !== null && turnTimeRemaining !== undefined && !player.isEliminated

  return (
    <div className={`relative flex flex-col items-center gap-1 ${containerHeight}`}>
      {/* Emoji display above avatar */}
      <div
        className={`absolute ${emojiTop} left-1/2 -translate-x-1/2 ${emojiSize} animate-bounce z-50 ${showEmoji && displayedEmoji ? "visible" : "invisible"}`}
      >
        {displayedEmoji || "😀"}
      </div>

      {showEmojiPicker && isLocalPlayer && (
        <div
          ref={emojiPickerRef}
          className="absolute -top-20 sm:-top-24 left-1/2 -translate-x-1/2 z-50 bg-black/95 border border-amber-900/50 rounded-xl p-3 shadow-xl"
        >
          <div className="grid grid-cols-4 gap-2 w-[160px] sm:w-[180px]">
            {ALLOWED_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation()
                  handleEmojiSelect(emoji)
                }}
                className="w-8 h-8 sm:w-10 sm:h-10 text-xl sm:text-2xl flex items-center justify-center hover:scale-110 transition-transform hover:bg-amber-900/30 rounded"
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
            relative ${avatarSize} rounded-full overflow-hidden
            border-2 sm:border-3 transition-all duration-500
            ${isActive ? "border-amber-500 shadow-[0_0_25px_rgba(217,119,6,0.7)] scale-110" : "border-amber-900/50"}
            ${isTarget ? "border-red-600 shadow-[0_0_25px_rgba(220,38,38,0.7)]" : ""}
            ${isClickable ? "hover:border-amber-400 hover:scale-105 hover:shadow-[0_0_20px_rgba(217,119,6,0.5)]" : ""}
          `}
          >
            <img src={player.avatar || "/placeholder.svg"} alt={player.name} className="w-full h-full object-cover" />
            {player.isEliminated && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <span className={`text-red-600 ${eliminatedX} font-bold`}>✕</span>
              </div>
            )}
          </div>
          {isActive && <div className="absolute -inset-1 bg-amber-500/30 rounded-full animate-pulse"></div>}
          {isClickable && (
            <div className="absolute inset-0 rounded-full border-2 border-amber-400/50 animate-pulse"></div>
          )}

          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5 h-3 sm:h-4">
            {seriesWins > 0 &&
              Array.from({ length: seriesWins }).map((_, i) => (
                <div
                  key={i}
                  className={`${winTokenSize} rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300 shadow-[0_0_8px_rgba(217,119,6,0.6)]`}
                  title={`Round ${i + 1} Win`}
                />
              ))}
          </div>
        </div>
      </button>

      {/* Player name and timer */}
      <div className={`flex flex-col items-center ${isSmall ? "h-8 sm:h-10 mt-1" : "h-10 sm:h-12 mt-2 sm:mt-3"}`}>
        <span
          className={`
          font-serif ${textSize} tracking-wider uppercase font-bold whitespace-nowrap
          ${isActive ? "text-amber-400" : "text-amber-700"}
          ${isTarget ? "text-red-500" : ""}
        `}
        >
          {player.name}
        </span>
        <span
          className={`
            font-mono ${textSize} font-bold h-4
            ${showTimer ? (turnTimeRemaining <= 3 ? "text-red-500 animate-pulse" : "text-amber-500") : "invisible"}
          `}
        >
          {turnTimeRemaining ?? 0}s
        </span>
      </div>

      {isLocalPlayer && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowEmojiPicker(!showEmojiPicker)
          }}
          className={`mt-0 ${isSmall ? "p-1" : "p-2"} rounded-full bg-amber-900/30 border border-amber-700/50 hover:bg-amber-800/50 hover:border-amber-600/70 transition-all hover:scale-110 active:scale-95`}
          title="Send emoji"
        >
          <MessageCircle className={`${isSmall ? "w-3 h-3" : "w-4 h-4 sm:w-5 sm:h-5"} text-amber-500`} />
        </button>
      )}
    </div>
  )
}
