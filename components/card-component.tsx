"use client"

import type { Card } from "@/types/game"

interface CardComponentProps {
  card: Card
  totalCards: number
  canFlip: boolean
  onFlip: () => void
  playerAvatar?: string
}

export default function CardComponent({ card, totalCards, canFlip, onFlip, playerAvatar }: CardComponentProps) {
  // Calculate position for fan layout
  const getCardPosition = (index: number, total: number) => {
    const spreadAngle = Math.min(15, 60 / total)
    const centerIndex = (total - 1) / 2
    const angleOffset = (index - centerIndex) * spreadAngle
    const xOffset = (index - centerIndex) * (total <= 2 ? 70 : total <= 3 ? 55 : 45)

    return {
      transform: `rotate(${angleOffset}deg) translateY(${Math.abs(index - centerIndex) * 5}px)`,
      left: `calc(50% + ${xOffset}px)`,
      marginLeft: "-40px",
    }
  }

  const position = getCardPosition(card.position, totalCards)

  return (
    <button
      onClick={() => canFlip && !card.isRevealed && onFlip()}
      disabled={!canFlip || card.isRevealed}
      className={`
        absolute top-1/2 -translate-y-1/2
        w-20 h-28 sm:w-22 sm:h-32 md:w-24 md:h-34 lg:w-26 lg:h-38
        rounded-lg sm:rounded-xl
        transition-all duration-300
        ${canFlip && !card.isRevealed ? "hover:scale-105 hover:-translate-y-3 cursor-pointer" : "cursor-default"}
      `}
      style={{ ...position, perspective: "1000px" }}
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
          <div className="absolute inset-2 sm:inset-3 border border-amber-800/40 rounded-md sm:rounded-lg"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 border-2 border-amber-700/60 rounded-full flex items-center justify-center">
              <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 bg-amber-800/40 rounded-full"></div>
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
          <div className="absolute inset-2 sm:inset-3 border border-red-800/40 rounded-md sm:rounded-lg"></div>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
            {playerAvatar && (
              <img
                src={playerAvatar || "/placeholder.svg"}
                alt="Owner"
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 border-red-700 object-cover"
              />
            )}
            <div className="mt-1 text-red-600 text-2xl sm:text-3xl md:text-4xl">☠</div>
          </div>
        </div>
      </div>
    </button>
  )
}
