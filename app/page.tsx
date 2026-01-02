"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Player, Card } from "@/types/game"
import type { Lobby, SharedGameState } from "@/types/multiplayer"
import PlayerSeat from "@/components/player-seat"
import CardComponent from "@/components/card-component"
import MatchmakingScreen from "@/components/matchmaking-screen"
import OfflineGame from "@/components/offline-game"
import {
  finishGame,
  leaveGame,
  sendHeartbeat,
  getGameState,
  makePickCard,
  getEmojiReactions,
  checkBotOnlyGame,
  voteForRematch,
} from "@/app/actions/multiplayer"

const TURN_TIMEOUT_MS = 15000
const GAME_START_DELAY_MS = 3000
const POLL_INTERVAL_MS = 500

const GAME_TURN_ORDER = [0, 2, 1, 3]
const VISUAL_COUNTER_CLOCKWISE = [0, 3, 1, 2]

export default function HideAndSeekCards() {
  const [playerId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("hideseek_player_id")
      if (stored) return stored
      const newId = `player-${crypto.randomUUID().slice(0, 12)}`
      sessionStorage.setItem("hideseek_player_id", newId)
      return newId
    }
    return `player-${crypto.randomUUID().slice(0, 12)}`
  })
  const [currentLobby, setCurrentLobby] = useState<Lobby | null>(null)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [sharedGameState, setSharedGameState] = useState<SharedGameState | null>(null)
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number | null>(null)
  const [gameStartCountdown, setGameStartCountdown] = useState<number | null>(null)
  const [playerReactions, setPlayerReactions] = useState<Record<string, string>>({})
  const lastVersionRef = useRef<number>(0)
  const isMountedRef = useRef(true)
  const [gameMode, setGameMode] = useState<"menu" | "matchmaking" | "playing" | "offline">("menu")
  const [localSelectedTarget, setLocalSelectedTarget] = useState<string | null>(null)
  const [hasVotedRematch, setHasVotedRematch] = useState(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const players: Player[] = Array.isArray(sharedGameState?.players)
    ? sharedGameState.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHuman: p.isHuman,
        isEliminated:
          sharedGameState.phase === "reveal_result" && sharedGameState.pendingEliminationId === p.id
            ? false
            : p.isEliminated,
        cardValue: p.cardValue,
        avatar: p.avatar,
      }))
    : []

  const cards: Card[] = Array.isArray(sharedGameState?.cards)
    ? sharedGameState.cards
        .filter((c) => {
          if (sharedGameState.phase === "reveal_result") {
            return true
          }
          const owner = sharedGameState.players.find((p) => p.id === c.ownerId)
          return owner && !owner.isEliminated
        })
        .map((c) => ({
          id: c.id,
          ownerId: c.ownerId,
          isRevealed: c.isRevealed,
          position: c.position,
        }))
    : []

  const currentPlayerIndex = sharedGameState?.currentPlayerIndex ?? 0
  const targetPlayerId = sharedGameState?.targetPlayerId ?? null
  const phase = sharedGameState?.phase ?? "waiting"
  const lastMessage = sharedGameState?.lastMessage ?? "Welcome to Hide and Seek Cards."
  const currentRound = sharedGameState?.currentRound ?? 1
  const roundWinnerId = sharedGameState?.roundWinnerId ?? null
  const seriesWinnerId = sharedGameState?.seriesWinnerId ?? null
  const rematchVotes = sharedGameState?.rematchVotes ?? []
  const roundWinner = roundWinnerId ? players.find((p) => p.id === roundWinnerId) : null
  const seriesWinner = seriesWinnerId ? players.find((p) => p.id === seriesWinnerId) : null

  const localPlayerGameIndex = players.findIndex((p) => p.id === playerId)
  const myTurnPosition = GAME_TURN_ORDER.indexOf(localPlayerGameIndex)

  const getVisualPlayer = (visualPosition: number) => {
    if (localPlayerGameIndex === -1 || players.length === 0) return players[visualPosition]
    const visualStep = VISUAL_COUNTER_CLOCKWISE.indexOf(visualPosition)
    const targetTurnPosition = (myTurnPosition - visualStep + 4) % 4
    const targetServerIndex = GAME_TURN_ORDER[targetTurnPosition]
    return players[targetServerIndex]
  }

  const getGameIndexForVisual = (visualPosition: number) => {
    if (localPlayerGameIndex === -1) return visualPosition
    const visualStep = VISUAL_COUNTER_CLOCKWISE.indexOf(visualPosition)
    const targetTurnPosition = (myTurnPosition - visualStep + 4) % 4
    return GAME_TURN_ORDER[targetTurnPosition]
  }

  const isVisualPositionActive = (visualPosition: number) => {
    return currentPlayerIndex === getGameIndexForVisual(visualPosition)
  }

  useEffect(() => {
    if (gameMode !== "playing" || !currentLobby) return

    const pollGameState = async () => {
      if (!isMountedRef.current || !playerId || !currentLobby) return

      try {
        const state = await getGameState(playerId)
        if (state && isMountedRef.current) {
          if (!Array.isArray(state.players) || !Array.isArray(state.cards)) {
            return
          }
          if (state.version !== lastVersionRef.current) {
            lastVersionRef.current = state.version
            setSharedGameState(state)
          }

          if (
            state.phase === "game_over" ||
            state.phase === "series_end" ||
            state.phase === "round_end" ||
            state.phase === "reveal_result" ||
            state.phase === "elimination_animation" ||
            state.pendingEliminationId
          ) {
            return
          }
        }

        const terminated = await checkBotOnlyGame(currentLobby.id)
        if (terminated) {
          if (isMountedRef.current) {
            setGameMode("menu")
            setCurrentLobby(null)
            setSharedGameState(null)
          }
          return
        }

        const reactions = await getEmojiReactions(currentLobby.id)
        if (isMountedRef.current) {
          setPlayerReactions(reactions || {})
        }
      } catch {
        // Silent fail
      }
    }

    const pollInterval = setInterval(pollGameState, POLL_INTERVAL_MS)
    return () => clearInterval(pollInterval)
  }, [gameMode, currentLobby, playerId])

  useEffect(() => {
    if (phase !== "waiting" || !sharedGameState?.gameStartTime) {
      setGameStartCountdown(null)
      return
    }

    const updateCountdown = () => {
      if (!isMountedRef.current) return
      const elapsed = Date.now() - sharedGameState.gameStartTime!
      const remaining = Math.max(0, Math.ceil((GAME_START_DELAY_MS - elapsed) / 1000))
      setGameStartCountdown(remaining)
    }

    updateCountdown()
    const countdownInterval = setInterval(updateCountdown, 100)
    return () => clearInterval(countdownInterval)
  }, [phase, sharedGameState?.gameStartTime])

  useEffect(() => {
    if (
      !sharedGameState?.turnStartTime ||
      phase === "game_over" ||
      phase === "series_end" ||
      phase === "round_end" ||
      phase === "reveal_result" ||
      phase === "waiting"
    ) {
      setTurnTimeRemaining(null)
      return
    }

    const updateTimer = () => {
      if (!isMountedRef.current) return
      const elapsed = Date.now() - sharedGameState.turnStartTime!
      const remaining = Math.max(0, Math.ceil((TURN_TIMEOUT_MS - elapsed) / 1000))
      setTurnTimeRemaining(remaining)
    }

    updateTimer()
    const timerInterval = setInterval(updateTimer, 100)
    return () => clearInterval(timerInterval)
  }, [sharedGameState?.turnStartTime, phase])

  useEffect(() => {
    if ((gameMode !== "playing" && gameMode !== "matchmaking") || !playerId) return

    const heartbeatInterval = setInterval(() => {
      if (isMountedRef.current) {
        sendHeartbeat(playerId)
      }
    }, 5000)

    sendHeartbeat(playerId)
    return () => clearInterval(heartbeatInterval)
  }, [gameMode, playerId])

  const handleSelectTarget = useCallback(
    (id: string) => {
      if (phase !== "select_target") return
      const currentPlayer = players[currentPlayerIndex]
      if (currentPlayer?.id !== playerId) return
      setLocalSelectedTarget(id)
    },
    [phase, players, currentPlayerIndex, playerId],
  )

  const handlePickCard = useCallback(
    async (cardId: string) => {
      if (phase !== "select_target" && phase !== "select_card") return
      const currentPlayer = players[currentPlayerIndex]
      if (currentPlayer?.id !== playerId) return

      const targetToUse = localSelectedTarget || targetPlayerId
      if (!targetToUse) return

      const newState = await makePickCard(playerId, cardId, targetToUse)
      if (newState && isMountedRef.current && Array.isArray(newState.players) && Array.isArray(newState.cards)) {
        lastVersionRef.current = newState.version
        setSharedGameState(newState)
        setLocalSelectedTarget(null)
      }
    },
    [phase, players, currentPlayerIndex, playerId, localSelectedTarget, targetPlayerId],
  )

  const handleGameStart = async (lobby: Lobby) => {
    setCurrentLobby(lobby)
    setGameMode("playing")
    lastVersionRef.current = 0
    setHasVotedRematch(false)

    try {
      const state = await getGameState(playerId)
      if (state && Array.isArray(state.players) && Array.isArray(state.cards)) {
        lastVersionRef.current = state.version
        setSharedGameState(state)
      }
    } catch {
      // Will be fetched on next poll
    }
  }

  const handlePlayAgain = async () => {
    if (currentLobby) {
      await finishGame(currentLobby.id)
    }
    setSharedGameState(null)
    setCurrentLobby(null)
    setPlayerReactions({})
    setTurnTimeRemaining(null)
    setGameStartCountdown(null)
    lastVersionRef.current = 0
    setLocalSelectedTarget(null)
    setHasVotedRematch(false)
    setGameMode("matchmaking")
  }

  const handleLeaveGame = async () => {
    await leaveGame(playerId)
    setShowLeaveModal(false)
    setGameMode("menu")
    setCurrentLobby(null)
    setSharedGameState(null)
    lastVersionRef.current = 0
  }

  const handleVoteRematch = async () => {
    if (hasVotedRematch) return
    setHasVotedRematch(true)
    try {
      await voteForRematch(playerId)
    } catch {
      setHasVotedRematch(false)
    }
  }

  useEffect(() => {
    if (phase === "waiting" && currentRound === 1) {
      setHasVotedRematch(false)
    }
  }, [phase, currentRound])

  useEffect(() => {
    if (phase === "select_target" && !targetPlayerId) {
      setLocalSelectedTarget(null)
    }
  }, [phase, targetPlayerId])

  const isCardSelectable = (card: Card) => {
    const currentPlayer = players[currentPlayerIndex]
    const hasTarget = localSelectedTarget || targetPlayerId
    return (
      (phase === "select_card" || (phase === "select_target" && hasTarget)) &&
      !card.isRevealed &&
      currentPlayer?.id === playerId
    )
  }

  const handleCardClick = (idx: number) => {
    if (cards[idx] && isCardSelectable(cards[idx])) {
      handlePickCard(cards[idx].id)
    }
  }

  const getCardPlayerAvatar = (card: Card) => {
    return players.find((p) => p.id === card.ownerId)?.avatar || "/placeholder.svg"
  }

  // Round end screen
  if (phase === "round_end" && roundWinner && gameMode === "playing") {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
        <div className="bg-[#0f0a05] border-2 border-amber-800/60 p-8 sm:p-10 rounded-3xl text-center max-w-md w-full shadow-[0_0_100px_rgba(217,119,6,0.2)]">
          <h2 className="font-serif text-2xl sm:text-3xl text-amber-600 mb-2 tracking-widest uppercase">
            Round {currentRound}
          </h2>
          <h3 className="font-serif text-3xl sm:text-4xl md:text-5xl text-amber-700 mb-6 tracking-widest uppercase font-bold">
            {roundWinner.id === playerId ? "Round Won!" : "Round Lost"}
          </h3>
          <div className="relative inline-block mb-6">
            <img
              src={roundWinner.avatar || "/placeholder.svg"}
              alt={roundWinner.name}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-amber-700 shadow-2xl object-cover"
            />
          </div>
          <p className="text-lg sm:text-xl text-amber-50/80 mb-4 font-serif font-light tracking-wide italic">
            {roundWinner.name} wins this round!
          </p>
          <div className="flex justify-center gap-6 mb-6">
            {sharedGameState?.players.map((p) => (
              <div key={p.id} className="flex flex-col items-center">
                <img
                  src={p.avatar || "/placeholder.svg"}
                  alt={p.name}
                  className="w-10 h-10 rounded-full border-2 border-amber-700/50"
                />
                <div className="flex gap-1 mt-1">
                  {Array.from({ length: p.seriesWins || 0 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-amber-500/80 font-serif text-sm">Next round starting...</p>
        </div>
      </div>
    )
  }

  // Series end screen
  if (phase === "series_end" && seriesWinner && gameMode === "playing") {
    const humanPlayers = sharedGameState?.players.filter((p) => p.isHuman) || []
    const voterAvatars = rematchVotes.map((id) => players.find((p) => p.id === id)).filter(Boolean)

    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
        <div className="bg-[#0f0a05] border-2 border-amber-800/60 p-8 sm:p-10 rounded-3xl text-center max-w-md w-full shadow-[0_0_100px_rgba(217,119,6,0.2)]">
          <h2 className="font-serif text-2xl sm:text-3xl text-amber-600 mb-2 tracking-widest uppercase">
            Series Complete
          </h2>
          <h3 className="font-serif text-3xl sm:text-4xl md:text-5xl text-amber-700 mb-6 tracking-widest uppercase font-bold">
            {seriesWinner.id === playerId ? "Victory!" : "Defeat"}
          </h3>
          <div className="relative inline-block mb-6">
            <img
              src={seriesWinner.avatar || "/placeholder.svg"}
              alt={seriesWinner.name}
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-amber-700 shadow-2xl object-cover"
            />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-amber-300 shadow-lg"
                />
              ))}
            </div>
          </div>
          <p className="text-lg sm:text-xl text-amber-50/80 mb-8 font-serif font-light tracking-wide italic">
            {seriesWinner.name} wins the series!
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleVoteRematch}
              disabled={hasVotedRematch}
              className={`relative w-full px-8 py-4 rounded-2xl font-bold transition-all font-serif tracking-widest border shadow-xl ${
                hasVotedRematch
                  ? "bg-amber-900/20 text-amber-500/60 border-amber-700/30 cursor-default"
                  : "bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 border-amber-700/50"
              }`}
            >
              {hasVotedRematch ? "Waiting for others..." : "Play Again (Same Players)"}
              {voterAvatars.length > 0 && (
                <div className="absolute -top-2 -right-2 flex -space-x-2">
                  {voterAvatars.map((voter) => (
                    <img
                      key={voter!.id}
                      src={voter!.avatar || "/placeholder.svg"}
                      alt={voter!.name}
                      className="w-6 h-6 rounded-full border-2 border-amber-600 shadow-md"
                    />
                  ))}
                </div>
              )}
            </button>
            {humanPlayers.length > 1 && (
              <p className="text-amber-500/60 text-xs">
                {rematchVotes.length} of {humanPlayers.length} voted to rematch
              </p>
            )}

            <button
              onClick={handlePlayAgain}
              className="w-full px-8 py-4 bg-black/40 hover:bg-black/60 text-amber-200/80 text-base sm:text-lg rounded-2xl font-bold transition-all font-serif tracking-widest border border-amber-700/30 shadow-xl"
            >
              Find New Game
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (gameMode === "offline") {
    return <OfflineGame onBack={() => setGameMode("menu")} />
  }

  if (gameMode === "matchmaking") {
    return <MatchmakingScreen playerId={playerId} onGameStart={handleGameStart} />
  }

  if (gameMode === "menu") {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.03)_0%,_#050505_80%)] opacity-50"></div>

        <div className="relative z-10 text-center max-w-lg">
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-amber-700 tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
            HIDE & SEEK
          </h1>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-amber-600 tracking-widest mb-12">CARDS</h2>

          <p className="text-amber-100/70 font-serif text-base sm:text-lg mb-12 leading-relaxed">
            A game of deception and fate. Four enter. One persists.
          </p>

          <div className="flex flex-col gap-4 mb-16">
            <button
              onClick={() => setGameMode("matchmaking")}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xl rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/50 shadow-xl"
            >
              Find Match
            </button>
            <button
              onClick={() => setGameMode("offline")}
              className="w-full px-12 py-4 bg-black/40 hover:bg-black/60 text-amber-200/80 text-lg rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/30 shadow-xl"
            >
              Play Offline
            </button>
          </div>

          <div className="bg-black/60 backdrop-blur-xl border border-amber-900/30 rounded-xl p-6">
            <h3 className="font-serif text-amber-500 text-lg font-bold tracking-wider uppercase mb-3 border-b border-amber-900/30 pb-2">
              How to Play
            </h3>
            <ul className="text-amber-200/80 text-sm space-y-2 text-left leading-relaxed">
              <li>• Everyone gets a secret card - but you don&apos;t know which one is yours!</li>
              <li>• On your turn, pick someone to hunt, then flip a card</li>
              <li>• Find their card? They&apos;re out! Find your own? Oops, you&apos;re out!</li>
              <li>• Win 2 rounds to win the series!</li>
            </ul>
          </div>

          <div className="bg-black/60 backdrop-blur-xl border border-amber-900/30 rounded-xl p-6 mt-4">
            <h3 className="font-serif text-amber-500 text-lg font-bold tracking-wider uppercase mb-3 border-b border-amber-900/30 pb-2">
              Our Story
            </h3>
            <p className="text-amber-200/80 text-sm text-left leading-relaxed">
              I built this game for my kids. They are actually the creators of this game and invented it on one of our
              family camping trips. We all had so much fun playing it, I wanted to bring the joy of the game to
              everyone.
            </p>
            <p className="text-amber-200/80 text-sm text-left leading-relaxed mt-3 italic">
              I hope you have fun playing, Hide and Seek Cards.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center relative overflow-hidden p-2 sm:p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.03)_0%,_#050505_80%)] opacity-50"></div>

      <div className="relative w-full max-w-[1000px] h-[calc(100vh-16px)] sm:h-[calc(100vh-32px)] max-h-[800px] bg-black/20 rounded-2xl border border-amber-900/20 flex flex-col">
        <div className="flex-shrink-0 pt-3 sm:pt-4 pb-1 text-center">
          <h1 className="font-serif text-xl sm:text-2xl md:text-3xl text-amber-700 tracking-widest drop-shadow-[0_0_20px_rgba(217,119,6,0.5)]">
            HIDE & SEEK CARDS
          </h1>
          {gameMode === "playing" && currentRound > 0 && (
            <p className="font-serif text-amber-500/60 text-xs sm:text-sm tracking-wider">
              Round {currentRound} of Best of 3
            </p>
          )}
        </div>

        <div className="flex-shrink-0 px-3 sm:px-6 md:px-12 pb-2">
          <div className="bg-black/90 backdrop-blur-xl border-2 border-amber-900/50 py-3 sm:py-4 px-4 sm:px-6 rounded-xl shadow-2xl min-h-[60px] sm:min-h-[70px] flex items-center justify-center">
            <p className="font-serif text-amber-100 text-sm sm:text-base md:text-lg tracking-wide leading-relaxed text-center">
              {lastMessage}
            </p>
          </div>
        </div>

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

        <div className="flex-grow relative min-h-[350px] sm:min-h-[400px]">
          <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-30">
            {getVisualPlayer(1) && (
              <PlayerSeat
                player={getVisualPlayer(1)!}
                isActive={isVisualPositionActive(1)}
                isTarget={(localSelectedTarget || targetPlayerId) === getVisualPlayer(1)?.id}
                canBeTargeted={
                  phase === "select_target" &&
                  !isVisualPositionActive(1) &&
                  players[currentPlayerIndex]?.id === playerId
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={isVisualPositionActive(1) ? turnTimeRemaining : null}
                displayedEmoji={playerReactions[getVisualPlayer(1)?.id || ""]}
                seriesWins={sharedGameState?.players.find((p) => p.id === getVisualPlayer(1)?.id)?.seriesWins || 0}
              />
            )}
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 left-2 sm:left-4 md:left-8 z-30">
            {getVisualPlayer(2) && (
              <PlayerSeat
                player={getVisualPlayer(2)!}
                isActive={isVisualPositionActive(2)}
                isTarget={(localSelectedTarget || targetPlayerId) === getVisualPlayer(2)?.id}
                canBeTargeted={
                  phase === "select_target" &&
                  !isVisualPositionActive(2) &&
                  players[currentPlayerIndex]?.id === playerId
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={isVisualPositionActive(2) ? turnTimeRemaining : null}
                displayedEmoji={playerReactions[getVisualPlayer(2)?.id || ""]}
                seriesWins={sharedGameState?.players.find((p) => p.id === getVisualPlayer(2)?.id)?.seriesWins || 0}
              />
            )}
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-4 md:right-8 z-30">
            {getVisualPlayer(3) && (
              <PlayerSeat
                player={getVisualPlayer(3)!}
                isActive={isVisualPositionActive(3)}
                isTarget={(localSelectedTarget || targetPlayerId) === getVisualPlayer(3)?.id}
                canBeTargeted={
                  phase === "select_target" &&
                  !isVisualPositionActive(3) &&
                  players[currentPlayerIndex]?.id === playerId
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={isVisualPositionActive(3) ? turnTimeRemaining : null}
                displayedEmoji={playerReactions[getVisualPlayer(3)?.id || ""]}
                seriesWins={sharedGameState?.players.find((p) => p.id === getVisualPlayer(3)?.id)?.seriesWins || 0}
              />
            )}
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {cards.map((card, idx) => (
                <CardComponent
                  key={card.id}
                  card={card}
                  isSelectable={isCardSelectable(card)}
                  onClick={() => handleCardClick(idx)}
                  playerAvatar={getCardPlayerAvatar(card)}
                />
              ))}
            </div>
          </div>

          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30">
            {getVisualPlayer(0) && (
              <PlayerSeat
                player={getVisualPlayer(0)!}
                isActive={isVisualPositionActive(0)}
                isTarget={(localSelectedTarget || targetPlayerId) === getVisualPlayer(0)?.id}
                canBeTargeted={
                  phase === "select_target" &&
                  !isVisualPositionActive(0) &&
                  players[currentPlayerIndex]?.id === playerId
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={isVisualPositionActive(0) ? turnTimeRemaining : null}
                displayedEmoji={playerReactions[getVisualPlayer(0)?.id || ""]}
                seriesWins={sharedGameState?.players.find((p) => p.id === getVisualPlayer(0)?.id)?.seriesWins || 0}
              />
            )}
          </div>
        </div>

        <div className="flex-shrink-0 px-3 sm:px-4 pb-3 sm:pb-4 flex justify-between">
          <button
            onClick={() => setShowLeaveModal(true)}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-red-900/60 hover:bg-red-800/80 text-red-100 rounded-lg font-serif font-bold text-sm sm:text-base border border-red-700/50 shadow-xl transition-all"
          >
            Leave Game
          </button>
          <button
            onClick={() => setShowRulesModal(true)}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-amber-900/60 hover:bg-amber-800/80 text-amber-100 rounded-lg font-serif font-bold text-sm sm:text-base border border-amber-700/50 shadow-xl transition-all"
          >
            Rules
          </button>
        </div>
      </div>

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
              If you leave, a bot will take your place. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-4 py-3 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 rounded-xl font-bold transition-all font-serif border border-amber-700/50"
              >
                Stay
              </button>
              <button
                onClick={handleLeaveGame}
                className="flex-1 px-4 py-3 bg-red-900/60 hover:bg-red-800/80 text-red-100 rounded-xl font-bold transition-all font-serif border border-red-700/50"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {showRulesModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowRulesModal(false)}
        >
          <div
            className="bg-black/95 backdrop-blur-xl border-2 border-amber-900/50 p-6 sm:p-8 rounded-2xl shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-amber-500 text-lg font-bold tracking-wider uppercase mb-4 text-center border-b border-amber-900/30 pb-3">
              How to Play
            </h3>
            <ul className="text-amber-200/80 text-sm sm:text-base space-y-3 leading-relaxed">
              <li>• Everyone gets a secret card - but you don&apos;t know which one is yours!</li>
              <li>• On your turn, pick someone to hunt, then flip a card</li>
              <li>• Find their card? They&apos;re out! Find your own? Oops, you&apos;re out!</li>
              <li>• Win 2 rounds to win the series!</li>
            </ul>
            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full mt-6 px-4 py-3 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 rounded-xl font-bold transition-all font-serif border border-amber-700/50"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
