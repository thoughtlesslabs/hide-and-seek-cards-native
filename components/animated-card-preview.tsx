"use client"

import { useState, useEffect } from "react"

export default function AnimatedCardPreview() {
  const [revealedCard, setRevealedCard] = useState<number | null>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const sequence = [
      { delay: 1500, action: () => setRevealedCard(1) },
      { delay: 3000, action: () => setRevealedCard(null) },
      { delay: 4500, action: () => setRevealedCard(2) },
      { delay: 6000, action: () => setRevealedCard(null) },
      { delay: 7500, action: () => setRevealedCard(0) },
      { delay: 9000, action: () => setRevealedCard(null) },
      { delay: 10500, action: () => setRevealedCard(3) },
      {
        delay: 12000,
        action: () => {
          setRevealedCard(null)
          setStep(0)
        },
      },
    ]

    const timers = sequence.map(({ delay, action }) => setTimeout(action, delay))

    const loopTimer = setInterval(() => {
      setStep((s) => s + 1)
    }, 12500)

    return () => {
      timers.forEach(clearTimeout)
      clearInterval(loopTimer)
    }
  }, [step])

  const cards = [
    { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mystic" },
    { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=shadow" },
    { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ember" },
    { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=frost" },
  ]

  return (
    <div className="relative flex items-center justify-center gap-2 sm:gap-3 py-4">
      {/* Glow effect behind cards */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-900/20 to-transparent blur-2xl" />

      {cards.map((card, index) => (
        <div
          key={index}
          className="relative w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28 transition-transform duration-300"
          style={{ perspective: "1000px" }}
        >
          <div
            className={`
              relative w-full h-full transition-transform duration-700
              ${revealedCard === index ? "[transform:rotateY(180deg)]" : ""}
            `}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Card Back */}
            <div
              className="absolute inset-0 rounded-lg overflow-hidden border-2 border-amber-900/60 bg-gradient-to-br from-amber-950 to-black shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="absolute inset-1.5 sm:inset-2 border border-amber-800/40 rounded-md" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 border-2 border-amber-700/60 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 bg-amber-800/40 rounded-full" />
                </div>
              </div>
            </div>

            {/* Card Front */}
            <div
              className="absolute inset-0 rounded-lg overflow-hidden border-2 border-red-900/80 bg-gradient-to-br from-red-950 to-black shadow-[0_4px_20px_rgba(0,0,0,0.9)]"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <div className="absolute inset-1.5 sm:inset-2 border border-red-800/40 rounded-md" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                <img
                  src={card.avatar || "/placeholder.svg"}
                  alt="Player"
                  className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 border-red-700 object-cover bg-white"
                />
                <div className="mt-0.5 text-red-600 text-lg sm:text-xl md:text-2xl">☠</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
