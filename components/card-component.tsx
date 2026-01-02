"use client"

import type { Card } from "@/types/game"
import { useEffect, useState } from "react"

interface CardComponentProps {
  card: Card
  totalCards: number
  canFlip: boolean
  onFlip: () => void
  playerAvatar?: string
  isDealing?: boolean
  dealIndex?: number
  isShuffling?: boolean
}

export default function CardComponent({
  card,
  totalCards,
  canFlip,
  onFlip,
  playerAvatar,
  isDealing = false,
  dealIndex = 0,
  isShuffling = false,
}: CardComponentProps) {
  const [hasDealt, setHasDealt] = useState(!isDealing)
  const [shuffleOffset, setShuffleOffset] = useState({ x: 0, y: 0, rotation: 0 })

  useEffect(() => {
    if (isDealing) {
      setHasDealt(false)
      const timer = setTimeout(
        () => {
          setHasDealt(true)
        },
        dealIndex * 200 + 100,
      ) // Stagger each card by 200ms
      return () => clearTimeout(timer)
    } else {
      setHasDealt(true)
    }
  }, [isDealing, dealIndex])

  useEffect(() => {
    if (isShuffling) {
      // Start with random offset
      setShuffleOffset({
        x: (Math.random() - 0.5) * 100,
        y: (Math.random() - 0.5) * 60,
        rotation: (Math.random() - 0.5) * 30,
      })

      // Animate back to center
      const timer = setTimeout(() => {
        setShuffleOffset({ x: 0, y: 0, rotation: 0 })
      }, 100)

      return () => clearTimeout(timer)
    } else {
      setShuffleOffset({ x: 0, y: 0, rotation: 0 })
    }
  }, [isShuffling])

  return (
    <button
      onClick={() => canFlip && !card.isRevealed && onFlip()}
      disabled={!canFlip || card.isRevealed}
      className={`
        relative flex-shrink-0
        w-20 h-28 sm:w-24 sm:h-34 md:w-28 md:h-40 lg:w-32 lg:h-44
        rounded-lg sm:rounded-xl
        transition-all duration-500
        ${canFlip && !card.isRevealed ? "hover:scale-110 hover:-translate-y-2 cursor-pointer" : "cursor-default"}
        ${!hasDealt ? "opacity-0 translate-y-20 scale-75" : "opacity-100 translate-y-0 scale-100"}
      `}
      style={{
        perspective: "1000px",
        transform: isShuffling
          ? `translate(${shuffleOffset.x}px, ${shuffleOffset.y}px) rotate(${shuffleOffset.rotation}deg)`
          : undefined,
        transitionDelay: !hasDealt ? `${dealIndex * 200}ms` : "0ms",
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
