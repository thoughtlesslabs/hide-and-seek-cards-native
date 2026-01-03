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
    ? "w-14 h-20 sm:w-16 sm:h-24 md:w-18 md:h-26"
    : "w-20 h-28 sm:w-24 sm:h-36 md:w-28 md:h-40 lg:w-32 lg:h-44"
  const avatarSize = isSmall ? "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" : "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16"
  const skullSize = isSmall ? "text-base sm:text-lg md:text-xl" : "text-2xl sm:text-3xl md:text-4xl"
  const innerCircleSize = isSmall ? "w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" : "w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14"
  const innerDotSize = isSmall ? "w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4" : "w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"

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
