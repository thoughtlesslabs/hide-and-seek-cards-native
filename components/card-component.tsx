"use client"

import type { Card } from "@/types/game"

interface CardComponentProps {
  card: Card
  totalCards: number
  canFlip: boolean
  onFlip: () => void
  playerAvatar?: string
  size?: "normal" | "small"
  className?: string
}

export default function CardComponent({
  card,
  canFlip,
  onFlip,
  playerAvatar,
  size = "normal",
  className = "",
}: CardComponentProps) {
  const isSmall = size === "small"
  const cardSize = isSmall
    ? "w-12 h-18 sm:w-14 sm:h-20 md:w-16 md:h-24"
    : "w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 lg:w-28 lg:h-40"
  const avatarSize = isSmall ? "w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10" : "w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14"
  const skullSize = isSmall ? "text-sm sm:text-base md:text-lg" : "text-xl sm:text-2xl md:text-3xl"
  const innerCircleSize = isSmall ? "w-4 h-4 sm:w-5 sm:h-5 md:w-7 md:h-7" : "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12"
  const innerDotSize = isSmall ? "w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3" : "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"

  return (
    <button
      onClick={() => canFlip && !card.isRevealed && onFlip()}
      disabled={!canFlip || card.isRevealed}
      className={`
        relative flex-shrink-0
        ${cardSize}
        rounded-lg sm:rounded-xl
        transition-all duration-500
        ${canFlip && !card.isRevealed ? "hover:scale-110 hover:-translate-y-2 cursor-pointer" : "cursor-default"}
        ${className}
      `}
      style={{
        perspective: "1000px",
      }}
    >
      <div
        className={`
          relative w-full h-full transition-transform duration-700
          transform-style-3d
          ${card.isRevealed ? "[transform:rotateY(180deg)]" : ""}
        `}
      >
        {/* Card Back */}
        <div
          className={`
            absolute inset-0 rounded-lg sm:rounded-xl overflow-hidden
            border-2 border-amber-900/60 bg-gradient-to-br from-amber-950 to-black
            shadow-[0_4px_20px_rgba(0,0,0,0.8)]
            backface-hidden
          `}
        >
          <div
            className={`absolute ${isSmall ? "inset-0.5 sm:inset-1" : "inset-2 sm:inset-3"} border border-amber-800/40 rounded-md sm:rounded-lg`}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`${innerCircleSize} border-2 border-amber-700/60 rounded-full flex items-center justify-center`}
            >
              <div className={`${innerDotSize} bg-amber-800/40 rounded-full`}></div>
            </div>
          </div>
          {canFlip && !card.isRevealed && (
            <div className="absolute inset-0 border-2 border-amber-400 rounded-lg sm:rounded-xl animate-pulse shadow-[0_0_15px_rgba(217,119,6,0.6)]"></div>
          )}
        </div>

        {/* Card Front */}
        <div
          className={`
            absolute inset-0 rounded-lg sm:rounded-xl overflow-hidden
            border-2 border-red-900/80 bg-gradient-to-br from-red-950 to-black
            shadow-[0_4px_20px_rgba(0,0,0,0.9)]
            backface-hidden [transform:rotateY(180deg)]
          `}
        >
          <div
            className={`absolute ${isSmall ? "inset-0.5 sm:inset-1" : "inset-2 sm:inset-3"} border border-red-800/40 rounded-md sm:rounded-lg`}
          ></div>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
            {playerAvatar && (
              <img
                src={playerAvatar || "/placeholder.svg"}
                alt="Owner"
                className={`${avatarSize} rounded-full border-2 border-red-700 object-cover`}
              />
            )}
            <div className={`mt-1 text-red-600 ${skullSize}`}>☠</div>
          </div>
        </div>
      </div>
    </button>
  )
}
