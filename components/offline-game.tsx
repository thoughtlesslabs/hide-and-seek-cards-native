"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Player, Card } from "@/types/game"
import PlayerSeat from "@/components/player-seat"
import CardComponent from "@/components/card-component"

const AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=mystic",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=shadow",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=ember",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=frost",
]

const BOT_NAMES = ["Morgana", "Silas", "Thorne", "Corvus", "Elara", "Grimm", "Vesper", "Nyx"]

const TURN_TIMEOUT_MS = 15000
const GAME_START_DELAY_MS = 3000

const COUNTER_CLOCKWISE_ORDER = [0, 2, 1, 3]

function getNextClockwiseIndex(currentIndex: number): number {
  const currentPosition = COUNTER_CLOCKWISE_ORDER.indexOf(currentIndex)
  const nextPosition = (currentPosition + 1) % COUNTER_CLOCKWISE_ORDER.length
  return COUNTER_CLOCKWISE_ORDER[nextPosition]
}

interface OfflineGameProps {
  onBack: () => void
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

type GamePhase =
  | "setup"
  | "waiting"
  | "select_target"
  | "select_card"
  | "reveal_result"
  | "elimination_animation"
  | "flipping"
  | "game_over"

interface PlayerConfig {
  isHuman: boolean
  avatar: string
  name: string
}

export default function OfflineGame({ onBack }: OfflineGameProps) {
  const [gamePhase, setGamePhase] = useState<GamePhase>("setup")
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>(() => {
    const shuffledAvatars = shuffleArray(AVATARS)
    const shuffledNames = shuffleArray(BOT_NAMES)
    return [
      { isHuman: true, avatar: shuffledAvatars[0], name: shuffledNames[0] },
      { isHuman: false, avatar: shuffledAvatars[1], name: shuffledNames[1] },
      { isHuman: false, avatar: shuffledAvatars[2], name: shuffledNames[2] },
      { isHuman: false, avatar: shuffledAvatars[3], name: shuffledNames[3] },
    ]
  })

  const [players, setPlayers] = useState<Player[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [targetPlayerId, setTargetPlayerId] = useState<string | null>(null)
  const [phase, setPhase] = useState<
    "waiting" | "select_target" | "select_card" | "reveal_result" | "elimination_animation" | "flipping" | "game_over"
  >("waiting")
  const [lastMessage, setLastMessage] = useState("The shadows gather...")
  const [winner, setWinner] = useState<Player | null>(null)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number | null>(null)
  const [gameStartCountdown, setGameStartCountdown] = useState<number | null>(null)
  const [eliminatedPlayerId, setEliminatedPlayerId] = useState<string | null>(null)

  const turnStartTimeRef = useRef<number | null>(null)
  const gameStartTimeRef = useRef<number | null>(null)
  const botTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const togglePlayerType = (index: number) => {
    setPlayerConfigs((prev) => {
      const newConfigs = [...prev]
      const wasHuman = newConfigs[index].isHuman

      // Count current humans
      const humanCount = newConfigs.filter((p) => p.isHuman).length

      // Don't allow removing last human
      if (wasHuman && humanCount <= 1) {
        return prev
      }

      newConfigs[index] = {
        ...newConfigs[index],
        isHuman: !wasHuman,
      }

      return newConfigs
    })
  }

  const startGame = () => {
    const newPlayers: Player[] = playerConfigs.map((config, index) => ({
      id: config.isHuman ? `player-human-${index}` : `player-bot-${index}`,
      name: config.name,
      isHuman: config.isHuman,
      isEliminated: false,
      cardValue: index,
      avatar: config.avatar,
    }))

    const newCards: Card[] = newPlayers.map((player, index) => ({
      id: `card-${index}`,
      ownerId: player.id,
      ownerName: player.name,
      ownerAvatar: player.avatar,
      isRevealed: false,
      position: index,
    }))

    setPlayers(newPlayers)
    setCards(shuffleArray(newCards))

    // Pick random starting player
    const startingIndex = Math.floor(Math.random() * 4)
    setCurrentPlayerIndex(startingIndex)

    setGamePhase("waiting")
    setPhase("waiting")
    gameStartTimeRef.current = Date.now()
    setGameStartCountdown(3)
    setLastMessage("The shadows gather...")
  }

  const resetToSetup = () => {
    setGamePhase("setup")
    const shuffledAvatars = shuffleArray(AVATARS)
    const shuffledNames = shuffleArray(BOT_NAMES)
    setPlayerConfigs([
      { isHuman: true, avatar: shuffledAvatars[0], name: shuffledNames[0] },
      { isHuman: false, avatar: shuffledAvatars[1], name: shuffledNames[1] },
      { isHuman: false, avatar: shuffledAvatars[2], name: shuffledNames[2] },
      { isHuman: false, avatar: shuffledAvatars[3], name: shuffledNames[3] },
    ])
    setPlayers([])
    setCards([])
    setCurrentPlayerIndex(0)
    setTargetPlayerId(null)
    setPhase("waiting")
    setLastMessage("The shadows gather...")
    setWinner(null)
    setShowRulesModal(false)
    setShowLeaveModal(false)
    setTurnTimeRemaining(null)
    setGameStartCountdown(null)
    setEliminatedPlayerId(null)
    turnStartTimeRef.current = null
    gameStartTimeRef.current = null
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current)
    }
    botTimeoutRef.current = null
  }

  useEffect(() => {
    return () => {
      if (botTimeoutRef.current) {
        clearTimeout(botTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (gamePhase !== "setup" && gamePhase !== "game_over" && gameStartTimeRef.current && phase === "waiting") {
      const interval = setInterval(() => {
        const elapsed = Date.now() - gameStartTimeRef.current!
        const remaining = Math.max(0, Math.ceil((GAME_START_DELAY_MS - elapsed) / 1000))
        setGameStartCountdown(remaining)

        if (remaining === 0) {
          clearInterval(interval)
          setPhase("select_target")
          turnStartTimeRef.current = Date.now()
          const currentPlayer = players[currentPlayerIndex]
          if (currentPlayer) {
            setLastMessage(`${currentPlayer.name}'s turn to hunt...`)
          }
        }
      }, 100)

      return () => clearInterval(interval)
    }
  }, [gamePhase, phase, players, currentPlayerIndex])

  useEffect(() => {
    if (
      phase === "game_over" ||
      phase === "reveal_result" ||
      phase === "waiting" ||
      phase === "elimination_animation" ||
      phase === "flipping" ||
      gamePhase === "setup"
    ) {
      setTurnTimeRemaining(null)
      return
    }

    if (!turnStartTimeRef.current) {
      turnStartTimeRef.current = Date.now()
    }

    const updateTimer = () => {
      const elapsed = Date.now() - turnStartTimeRef.current!
      const remaining = Math.max(0, Math.ceil((TURN_TIMEOUT_MS - elapsed) / 1000))
      setTurnTimeRemaining(remaining)

      // Auto-move on timeout for human player
      if (remaining <= 0) {
        const currentPlayer = players[currentPlayerIndex]
        if (currentPlayer?.isHuman && !currentPlayer.isEliminated) {
          handleTimeout()
        }
      }
    }

    updateTimer()
    const timerInterval = setInterval(updateTimer, 100)

    return () => clearInterval(timerInterval)
  }, [phase, currentPlayerIndex, players, gamePhase])

  useEffect(() => {
    if (
      phase === "game_over" ||
      phase === "reveal_result" ||
      phase === "waiting" ||
      phase === "elimination_animation" ||
      phase === "flipping" ||
      gamePhase === "setup"
    )
      return

    const currentPlayer = players[currentPlayerIndex]
    if (!currentPlayer || currentPlayer.isHuman || currentPlayer.isEliminated) return

    // Clear any existing timeout
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current)
    }

    // Bot takes 1-2 seconds to "think"
    botTimeoutRef.current = setTimeout(
      () => {
        if (phase === "select_target") {
          handleBotSelectTarget()
        } else if (phase === "select_card") {
          handleBotSelectCard()
        }
      },
      1000 + Math.random() * 1000,
    )

    return () => {
      if (botTimeoutRef.current) {
        clearTimeout(botTimeoutRef.current)
      }
    }
  }, [phase, currentPlayerIndex, players, gamePhase])

  const handleTimeout = () => {
    if (phase === "select_target") {
      // Pick random valid target
      const validTargets = players.filter((p, idx) => !p.isEliminated && idx !== currentPlayerIndex)
      if (validTargets.length > 0) {
        const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)]
        setTargetPlayerId(randomTarget.id)

        // Now pick a random card
        const unrevealedCards = cards.filter((c) => !c.isRevealed)
        if (unrevealedCards.length > 0) {
          const randomCard = unrevealedCards[Math.floor(Math.random() * unrevealedCards.length)]
          // Directly execute the card pick logic instead of calling handlePickCard
          executePickCard(randomCard.id, randomTarget.id)
        }
      }
    } else if (phase === "select_card" && targetPlayerId) {
      // Pick random unrevealed card
      const unrevealedCards = cards.filter((c) => !c.isRevealed)
      if (unrevealedCards.length > 0) {
        const randomCard = unrevealedCards[Math.floor(Math.random() * unrevealedCards.length)]
        executePickCard(randomCard.id, targetPlayerId)
      }
    }
  }

  const handleBotSelectTarget = () => {
    const currentPlayer = players[currentPlayerIndex]
    const validTargets = players.filter((p, idx) => !p.isEliminated && idx !== currentPlayerIndex)

    if (validTargets.length > 0) {
      const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)]
      setTargetPlayerId(randomTarget.id)
      setLastMessage(`${currentPlayer.name} targets ${randomTarget.name}...`)
      setPhase("select_card")
      turnStartTimeRef.current = Date.now()
      handleBotSelectCard()
    }
  }

  const handleBotSelectCard = () => {
    const unrevealedCards = cards.filter((c) => !c.isRevealed)
    if (unrevealedCards.length > 0) {
      const randomCard = unrevealedCards[Math.floor(Math.random() * unrevealedCards.length)]
      handlePickCard(randomCard.id)
    }
  }

  const handleSelectTarget = useCallback(
    (id: string) => {
      if (phase !== "select_target") return

      const currentPlayer = players[currentPlayerIndex]
      if (!currentPlayer?.isHuman) return

      const target = players.find((p) => p.id === id)
      if (!target || target.isEliminated) return

      setTargetPlayerId(id)
      setLastMessage(`${currentPlayer.name} targets ${target.name}...`)
      // Don't change phase - stay in select_target until card is picked
    },
    [phase, players, currentPlayerIndex],
  )

  const executePickCard = useCallback(
    (cardId: string, targetId: string) => {
      const card = cards.find((c) => c.id === cardId)
      if (!card || card.isRevealed) return

      const currentPlayer = players[currentPlayerIndex]
      const cardOwner = players.find((p) => p.id === card.ownerId)

      // Reveal the card
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, isRevealed: true } : c)))

      // Determine outcome
      let message = ""
      let eliminatedId: string | null = null

      if (card.ownerId === currentPlayer.id) {
        // Self-elimination
        message = `${currentPlayer.name} drew their own card! Self-elimination!`
        eliminatedId = currentPlayer.id
      } else if (card.ownerId === targetId) {
        // Target found
        message = `${currentPlayer.name} found ${cardOwner?.name}'s card! ${cardOwner?.name} is eliminated!`
        eliminatedId = targetId
      } else {
        // Miss
        message = `${currentPlayer.name} revealed ${cardOwner?.name}'s card. A miss...`
      }

      setLastMessage(message)
      setPhase("reveal_result")
      setEliminatedPlayerId(eliminatedId)

      // Wait for card reveal animation (1.5s)
      setTimeout(() => {
        if (eliminatedId) {
          setPhase("elimination_animation")
          setTimeout(() => {
            processElimination(eliminatedId, currentPlayer.id)
          }, 1500)
        } else {
          setCards((prev) => prev.map((c) => ({ ...c, isRevealed: false })))
          setPhase("flipping")

          // Wait for flip animation (800ms) then shuffle
          setTimeout(() => {
            setCards((prev) => {
              const shuffled = shuffleArray(prev)
              return shuffled.map((c, idx) => ({ ...c, position: idx }))
            })
            processNextTurn(currentPlayerIndex, null)
          }, 800)
        }
      }, 1500)
    },
    [cards, players, currentPlayerIndex],
  )

  const handlePickCard = useCallback(
    (cardId: string) => {
      if (phase !== "select_card" && !(phase === "select_target" && targetPlayerId)) return
      if (!targetPlayerId) return

      executePickCard(cardId, targetPlayerId)
    },
    [phase, targetPlayerId, executePickCard],
  )

  const processElimination = (eliminatedId: string, currentPlayerId: string) => {
    // Eliminate the player
    setPlayers((prev) => prev.map((p) => (p.id === eliminatedId ? { ...p, isEliminated: true } : p)))

    setCards((prev) => {
      const remainingCards = prev.filter((c) => c.ownerId !== eliminatedId).map((c) => ({ ...c, isRevealed: false }))
      return remainingCards
    })

    setPhase("flipping")

    // Wait for flip animation then shuffle
    setTimeout(() => {
      setCards((prev) => {
        const shuffled = shuffleArray(prev)
        return shuffled.map((c, idx) => ({ ...c, position: idx }))
      })
      processNextTurn(currentPlayerId, eliminatedId)
    }, 800)
  }

  const processNextTurn = (currentPlayerId: string, eliminatedId: string | null) => {
    // Check for winner
    const alivePlayers = players.filter((p) => !p.isEliminated && p.id !== eliminatedId)

    if (alivePlayers.length === 1) {
      setWinner(alivePlayers[0])
      setLastMessage(`${alivePlayers[0].name} is the last one standing!`)
      setPhase("game_over")
      setGamePhase("game_over")
      return
    }

    let nextIndex = getNextClockwiseIndex(currentPlayerIndex)

    // Skip eliminated players
    let attempts = 0
    while (attempts < 4) {
      const nextPlayer = players[nextIndex]
      if (nextPlayer && !nextPlayer.isEliminated && nextPlayer.id !== eliminatedId) {
        break
      }
      nextIndex = getNextClockwiseIndex(nextIndex)
      attempts++
    }

    setCurrentPlayerIndex(nextIndex)
    setTargetPlayerId(null)
    setEliminatedPlayerId(null)
    setPhase("select_target")
    turnStartTimeRef.current = Date.now()

    const nextPlayer = players[nextIndex]
    if (nextPlayer) {
      setLastMessage(`${nextPlayer.name}'s turn to hunt...`)
    }
  }

  const isCardSelectable = (card: Card) => {
    const currentPlayer = players[currentPlayerIndex]
    // Can select card when target is selected (still in select_target phase) or in select_card phase
    return (
      ((phase === "select_target" && targetPlayerId !== null) || phase === "select_card") &&
      !card.isRevealed &&
      currentPlayer?.isHuman
    )
  }

  const handleCardClick = (cardId: string) => {
    if (isCardSelectable(cards.find((c) => c.id === cardId)!)) {
      handlePickCard(cardId)
    }
  }

  const getCardPlayerAvatar = (card: Card) => {
    return players.find((p) => p.id === card.ownerId)?.avatar || "/placeholder.svg"
  }

  // Filter cards based on phase - during reveal_result and elimination_animation, show eliminated player's card
  const visibleCards = cards.filter((c) => {
    if (phase === "reveal_result" || phase === "elimination_animation") {
      return true
    }
    const owner = players.find((p) => p.id === c.ownerId)
    return owner && !owner.isEliminated
  })

  // Apply elimination visual only during elimination_animation phase
  const getPlayerForDisplay = (player: Player) => {
    if (phase === "elimination_animation" && player.id === eliminatedPlayerId) {
      return { ...player, isEliminated: true }
    }
    return player
  }

  // Setup screen
  if (gamePhase === "setup") {
    const humanCount = playerConfigs.filter((p) => p.isHuman).length
    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.03)_0%,_#050505_80%)] opacity-50"></div>

        <div className="relative z-10 w-full max-w-lg">
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-amber-700 tracking-widest mb-2 text-center drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
            HIDE & SEEK
          </h1>
          <h2 className="font-serif text-2xl sm:text-3xl text-amber-600 tracking-widest mb-8 text-center">CARDS</h2>

          <div className="bg-black/40 border border-amber-900/40 rounded-2xl p-6 mb-6">
            <h3 className="font-serif text-amber-500 text-lg sm:text-xl mb-4 text-center tracking-wider">
              Choose Players
            </h3>
            <p className="text-amber-100/60 text-sm text-center mb-6">
              Tap a seat to toggle between Human and Computer
            </p>

            <div className="grid grid-cols-2 gap-4">
              {playerConfigs.map((config, index) => (
                <button
                  key={index}
                  onClick={() => togglePlayerType(index)}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    config.isHuman
                      ? "bg-amber-900/30 border-amber-600/60 hover:bg-amber-800/40"
                      : "bg-black/40 border-amber-900/30 hover:bg-black/60"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <img
                        src={config.avatar || "/placeholder.svg"}
                        alt={config.name}
                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 object-cover ${
                          config.isHuman ? "border-amber-500" : "border-amber-900/50"
                        }`}
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          config.isHuman ? "bg-amber-600 text-white" : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {config.isHuman ? "H" : "C"}
                      </div>
                    </div>
                    <span className="font-serif text-amber-200 text-sm sm:text-base">{config.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        config.isHuman ? "bg-amber-600/30 text-amber-300" : "bg-gray-700/30 text-gray-400"
                      }`}
                    >
                      {config.isHuman ? "Human" : "Computer"}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-amber-100/50 text-xs text-center mt-4">
              {humanCount} Human{humanCount !== 1 ? "s" : ""} • {4 - humanCount} Computer
              {4 - humanCount !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={startGame}
              className="w-full px-8 py-4 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-lg sm:text-xl rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/50 shadow-xl"
            >
              Start Game
            </button>
            <button
              onClick={onBack}
              className="w-full px-8 py-3 bg-black/40 hover:bg-black/60 text-amber-200/70 text-base rounded-2xl font-bold transition-all font-serif tracking-widest border border-amber-700/30 shadow-xl"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (winner && phase === "game_over") {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
        <div className="bg-[#0f0a05] border-2 border-amber-800/60 p-8 sm:p-10 rounded-3xl text-center max-w-md w-full shadow-[0_0_100px_rgba(217,119,6,0.2)]">
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-amber-700 mb-6 tracking-widest uppercase font-bold">
            {winner.isHuman ? "Victory!" : "Defeat"}
          </h2>
          <div className="relative inline-block mb-6">
            <img
              src={winner.avatar || "/placeholder.svg"}
              alt={winner.name}
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-amber-700 shadow-2xl object-cover"
            />
          </div>
          <p className="text-lg sm:text-xl text-amber-50/80 mb-8 font-serif font-light tracking-wide italic">
            {winner.name} persists.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={resetToSetup}
              className="w-full px-8 py-4 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-base sm:text-lg rounded-2xl font-bold transition-all font-serif tracking-widest border border-amber-700/50 shadow-xl"
            >
              Play Again
            </button>
            <button
              onClick={onBack}
              className="w-full px-8 py-4 bg-black/40 hover:bg-black/60 text-amber-200/70 text-base sm:text-lg rounded-2xl font-bold transition-all font-serif tracking-widest border border-amber-700/30 shadow-xl"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center relative overflow-hidden p-2 sm:p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.03)_0%,_#050505_80%)] opacity-50"></div>

      <div className="relative w-full max-w-[1000px] h-[calc(100vh-16px)] sm:h-[calc(100vh-32px)] max-h-[800px] bg-black/20 rounded-2xl border border-amber-900/20 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 pt-3 sm:pt-4 pb-1 text-center">
          <h1 className="font-serif text-xl sm:text-2xl md:text-3xl text-amber-700 tracking-widest drop-shadow-[0_0_20px_rgba(217,119,6,0.5)]">
            HIDE & SEEK CARDS
          </h1>
          <p className="text-amber-600/60 text-xs sm:text-sm font-serif">Offline Mode</p>
        </div>

        {/* Message Box */}
        <div className="flex-shrink-0 px-3 sm:px-6 md:px-12 pb-2">
          <div className="bg-black/90 backdrop-blur-xl border-2 border-amber-900/50 py-3 sm:py-4 px-4 sm:px-6 rounded-xl shadow-2xl min-h-[60px] sm:min-h-[70px] md:min-h-[80px] flex items-center justify-center">
            <p className="font-serif text-amber-100 text-sm sm:text-base md:text-lg tracking-wide leading-relaxed text-center">
              {lastMessage}
            </p>
          </div>
        </div>

        {/* Countdown Overlay */}
        {phase === "waiting" && gameStartCountdown !== null && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center rounded-2xl">
            <div className="text-center">
              <p className="font-serif text-amber-500 text-2xl sm:text-3xl md:text-4xl tracking-widest mb-4">
                GET READY
              </p>
              <p className="font-serif text-amber-300 text-5xl sm:text-6xl md:text-7xl font-bold">
                {gameStartCountdown}
              </p>
            </div>
          </div>
        )}

        {/* Game Area */}
        <div className="flex-grow relative min-h-[350px] sm:min-h-[400px]">
          {/* North Player */}
          <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-30">
            {players[1] && (
              <PlayerSeat
                player={getPlayerForDisplay(players[1])}
                isActive={currentPlayerIndex === 1}
                isTarget={targetPlayerId === players[1].id}
                canBeTargeted={
                  phase === "select_target" && currentPlayerIndex !== 1 && players[currentPlayerIndex]?.isHuman
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={currentPlayerIndex === 1 ? turnTimeRemaining : null}
              />
            )}
          </div>

          {/* West Player */}
          <div className="absolute top-1/2 -translate-y-1/2 left-2 sm:left-4 md:left-8 z-30">
            {players[2] && (
              <PlayerSeat
                player={getPlayerForDisplay(players[2])}
                isActive={currentPlayerIndex === 2}
                isTarget={targetPlayerId === players[2].id}
                canBeTargeted={
                  phase === "select_target" && currentPlayerIndex !== 2 && players[currentPlayerIndex]?.isHuman
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={currentPlayerIndex === 2 ? turnTimeRemaining : null}
              />
            )}
          </div>

          {/* East Player */}
          <div className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-4 md:right-8 z-30">
            {players[3] && (
              <PlayerSeat
                player={getPlayerForDisplay(players[3])}
                isActive={currentPlayerIndex === 3}
                isTarget={targetPlayerId === players[3].id}
                canBeTargeted={
                  phase === "select_target" && currentPlayerIndex !== 3 && players[currentPlayerIndex]?.isHuman
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={currentPlayerIndex === 3 ? turnTimeRemaining : null}
              />
            )}
          </div>

          {/* Cards */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {visibleCards.map((card) => (
                <CardComponent
                  key={card.id}
                  card={card}
                  isSelectable={isCardSelectable(card)}
                  onClick={() => handleCardClick(card.id)}
                  playerAvatar={getCardPlayerAvatar(card)}
                />
              ))}
            </div>
          </div>

          {/* South Player */}
          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30">
            {players[0] && (
              <PlayerSeat
                player={getPlayerForDisplay(players[0])}
                isActive={currentPlayerIndex === 0}
                isTarget={targetPlayerId === players[0].id}
                canBeTargeted={
                  phase === "select_target" && currentPlayerIndex !== 0 && players[currentPlayerIndex]?.isHuman
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={currentPlayerIndex === 0 ? turnTimeRemaining : null}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-3 sm:px-4 pb-3 sm:pb-4 flex justify-between">
          <button
            onClick={() => setShowLeaveModal(true)}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-red-900/60 hover:bg-red-800/80 text-red-100 rounded-lg font-serif font-bold text-sm sm:text-base border border-red-700/50 shadow-xl transition-all transform hover:scale-105"
          >
            Leave Game
          </button>
          <button
            onClick={() => setShowRulesModal(true)}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-amber-900/60 hover:bg-amber-800/80 text-amber-100 rounded-lg font-bold font-serif border border-amber-700/50 shadow-xl transition-all transform hover:scale-105"
          >
            Rules
          </button>
        </div>
      </div>

      {/* Leave Modal */}
      {showLeaveModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowLeaveModal(false)}
        >
          <div
            className="bg-black/95 backdrop-blur-xl border-2 border-red-900/50 p-6 sm:p-8 rounded-2xl shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-red-500 text-xl sm:text-2xl font-bold tracking-wider uppercase mb-4 text-center">
              Leave Game?
            </h3>
            <p className="text-amber-100/80 text-center mb-6 text-sm sm:text-base">
              Are you sure you want to leave this offline game?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-4 py-3 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 rounded-xl font-bold font-serif border border-amber-700/50 transition-all"
              >
                Stay
              </button>
              <button
                onClick={onBack}
                className="flex-1 px-4 py-3 bg-red-900/60 hover:bg-red-800/80 text-red-100 rounded-xl font-bold font-serif border border-red-700/50 transition-all"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowRulesModal(false)}
        >
          <div
            className="bg-black/95 backdrop-blur-xl border-2 border-amber-900/50 p-6 sm:p-8 rounded-2xl shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-serif text-amber-500 text-xl sm:text-2xl font-bold tracking-wider uppercase">
                Rules
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-amber-500 hover:text-amber-300 text-3xl font-bold leading-none"
              >
                ×
              </button>
            </div>
            <ul className="space-y-3 text-amber-100/90 text-base sm:text-lg leading-relaxed">
              <li>• Each player is assigned one card</li>
              <li>• Choose a target, then pick a card</li>
              <li>• Find your target&apos;s card to eliminate them</li>
              <li>• Draw your own card = elimination</li>
              <li>• Last player standing wins</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
