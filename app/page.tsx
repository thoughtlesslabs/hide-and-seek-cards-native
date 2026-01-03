"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Player, Card } from "@/types/game"
import type { Lobby, SharedGameState } from "@/types/multiplayer"
import PlayerSeat from "@/components/player-seat"
import CardComponent from "@/components/card-component"
import MatchmakingScreen from "@/components/matchmaking-screen"
import OfflineGame from "@/components/offline-game"
import AnimatedCardPreview from "@/components/animated-card-preview"
import LiveStats from "@/components/live-stats"
import PrivateLobbyScreen from "@/components/private-lobby-screen"
import {
  pollGameState,
  sendHeartbeat,
  selectTarget,
  selectCard,
  sendEmojiReaction,
  hostPrivateLobby,
  joinByCode,
  getLobbyStatus, // Import getLobbyStatus
  joinMatchmaking, // Import joinMatchmaking
  leaveGame, // Import leaveGame
  // Updated imports:
  leaveLobby,
  hostStartGame,
  voteForRematch,
  getLobbiesWaitingByConfig,
} from "./actions/multiplayer"

const TURN_TIMEOUT_MS = 15000
const GAME_START_DELAY_MS = 3000
const REMATCH_TIMEOUT_SECONDS = 30
const POLL_INTERVAL_MS = 500

// Game turn order: 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 (clockwise from bottom)
const GAME_TURN_ORDER = [0, 1, 2, 3, 4, 5, 6, 7]
// Visual positions: 0=S, 1=SW, 2=W, 3=NW, 4=N, 5=NE, 6=E, 7=SE (counter-clockwise)
const VISUAL_COUNTER_CLOCKWISE = [0, 1, 2, 3, 4, 5, 6, 7]
// Visual positions for 4 players
const VISUAL_COUNTER_CLOCKWISE_4 = [0, 2, 4, 6] // S, W, N, E

export default function HideAndSeekCards() {
  // Changed function name
  const [playerId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("hideseek-player-id")
      if (stored) return stored
      const newId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      localStorage.setItem("hideseek-player-id", newId)
      return newId
    }
    return `player-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
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
  const [gameMode, setGameMode] = useState<
    | "menu"
    | "roundSelection"
    | "playerSelection"
    | "matchmaking"
    | "playing"
    | "offline"
    | "hostOrJoin"
    | "hostPlayerSelection"
    | "hostRoundSelection"
    | "privateLobby"
    | "joinWithCode"
    | null // Added null to allow setting gameMode to null
  >("menu")
  const [selectedRoundsToWin, setSelectedRoundsToWin] = useState<number>(2) // Default to best of 3
  const [selectedPlayerCount, setSelectedPlayerCount] = useState<number>(8)
  const [localSelectedTarget, setLocalSelectedTarget] = useState<string | null>(null)
  const [hasVotedRematch, setHasVotedRematch] = useState(false)
  const [rematchCountdown, setRematchCountdown] = useState<number | null>(null)
  const [gameStartedWhileAway, setGameStartedWhileAway] = useState(false)
  const [pendingGameLobby, setPendingGameLobby] = useState<Lobby | null>(null)
  const [privateGameCode, setPrivateGameCode] = useState<string>("")
  const [isHost, setIsHost] = useState(false)
  const [joinCodeInput, setJoinCodeInput] = useState("")
  const [joinError, setJoinError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [lobbyStats, setLobbyStats] = useState<{
    fourPlayer: { single: number; bestOf3: number; bestOf5: number }
    eightPlayer: { single: number; bestOf3: number; bestOf5: number }
  } | null>(null)

  const handleLeaveGame = useCallback(async () => {
    try {
      await leaveGame(playerId)
    } catch (e) {
      console.error("[v0] Error leaving game:", e)
    }
    setShowLeaveModal(false)
    // Reset all game state
    setSharedGameState(null)
    setCurrentLobby(null)
    setPlayerReactions({})
    setTurnTimeRemaining(null)
    setGameStartCountdown(null)
    lastVersionRef.current = 0
    setLocalSelectedTarget(null)
    setHasVotedRematch(false)
    setGameMode("menu")
  }, [playerId])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (gameMode === "playerSelection" || gameMode === "roundSelection") {
      getLobbiesWaitingByConfig().then(setLobbyStats)
      const interval = setInterval(() => {
        getLobbiesWaitingByConfig().then(setLobbyStats)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [gameMode])

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
  const roundsToWin = sharedGameState?.roundsToWin ?? 2
  const roundWinnerId = sharedGameState?.roundWinnerId ?? null
  const seriesWinnerId = sharedGameState?.seriesWinnerId ?? null
  const rematchVotes = sharedGameState?.rematchVotes ?? []
  const roundWinner = roundWinnerId ? players.find((p) => p.id === roundWinnerId) : null
  const seriesWinner = seriesWinnerId ? players.find((p) => p.id === seriesWinnerId) : null

  const localPlayerGameIndex = players.findIndex((p) => p.id === playerId)
  const myTurnPosition = GAME_TURN_ORDER.indexOf(localPlayerGameIndex)

  const getVisualPlayer = useCallback(
    (visualPosition: number) => {
      if (!sharedGameState || !sharedGameState.players.length) return null

      const totalPlayers = sharedGameState.players.length
      const visualOrder = selectedPlayerCount === 4 ? VISUAL_COUNTER_CLOCKWISE_4 : VISUAL_COUNTER_CLOCKWISE

      // Check if this visual position is used in current player count mode
      const indexInOrder = visualOrder.indexOf(visualPosition)
      if (indexInOrder === -1) return null

      // Find local player's position in the visual order
      const localPlayerVisualIndex =
        localPlayerGameIndex >= 0 && localPlayerGameIndex < totalPlayers ? localPlayerGameIndex : 0

      // Rotate so local player appears at visual position 0 (bottom of screen)
      const rotatedIndex = (indexInOrder + localPlayerVisualIndex) % totalPlayers

      return sharedGameState.players[rotatedIndex] || null
    },
    [sharedGameState, selectedPlayerCount, localPlayerGameIndex],
  )

  const getGameIndexForVisual = (visualPosition: number) => {
    if (!sharedGameState || !sharedGameState.players.length) return -1

    const totalPlayers = sharedGameState.players.length
    const visualOrder = selectedPlayerCount === 4 ? VISUAL_COUNTER_CLOCKWISE_4 : VISUAL_COUNTER_CLOCKWISE

    const indexInOrder = visualOrder.indexOf(visualPosition)
    if (indexInOrder === -1) return -1

    const localPlayerVisualIndex =
      localPlayerGameIndex >= 0 && localPlayerGameIndex < totalPlayers ? localPlayerGameIndex : 0

    return (indexInOrder + localPlayerVisualIndex) % totalPlayers
  }

  const isVisualPositionActive = (visualPosition: number) => {
    return currentPlayerIndex === getGameIndexForVisual(visualPosition)
  }

  useEffect(() => {
    if (gameMode !== "playing" || !currentLobby || !playerId) return

    const pollGameStateInterval = setInterval(() => {
      if (isMountedRef.current) {
        pollGameState(playerId).then((result) => {
          if (result && isMountedRef.current) {
            const { state, reactions } = result
            if ((state && !Array.isArray(state.players)) || (state && !Array.isArray(state.cards))) {
              return
            }
            if (state && state.version !== lastVersionRef.current) {
              lastVersionRef.current = state.version
              setSharedGameState(state)
            }
            // Update reactions
            if (reactions && typeof reactions === "object") {
              setPlayerReactions(reactions)
            }
          }
        })
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(pollGameStateInterval)
  }, [gameMode, currentLobby, playerId])

  useEffect(() => {
    if (gameMode !== "playing" || !sharedGameState?.gameStartTime) return
    if (sharedGameState.phase !== "waiting") {
      setGameStartCountdown(null)
      return
    }

    const updateCountdown = () => {
      if (!isMountedRef.current) return // Added this check for safety
      const elapsed = Date.now() - sharedGameState.gameStartTime!
      const remaining = Math.max(0, Math.ceil((GAME_START_DELAY_MS - elapsed) / 1000))
      setGameStartCountdown(remaining)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 100)
    return () => clearInterval(interval)
  }, [gameMode, sharedGameState?.gameStartTime, sharedGameState?.phase])

  useEffect(() => {
    if (gameMode !== "playing" || !sharedGameState?.turnStartTime) return
    if (sharedGameState.phase !== "select_target" && sharedGameState.phase !== "select_card") {
      setTurnTimeRemaining(null)
      return
    }

    const updateTimer = () => {
      if (!isMountedRef.current) return // Added this check for safety
      const elapsed = Date.now() - sharedGameState.turnStartTime!
      const remaining = Math.max(0, Math.ceil((TURN_TIMEOUT_MS - elapsed) / 1000))
      setTurnTimeRemaining(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 100)
    return () => clearInterval(interval)
  }, [gameMode, sharedGameState?.turnStartTime, sharedGameState?.phase])

  useEffect(() => {
    if (gameMode !== "playing" || !currentLobby) return

    const heartbeatInterval = setInterval(() => {
      if (isMountedRef.current) {
        // Added this check for safety
        sendHeartbeat(playerId)
      }
    }, 5000)

    sendHeartbeat(playerId)
    return () => clearInterval(heartbeatInterval)
  }, [gameMode, currentLobby, playerId])

  useEffect(() => {
    if (phase === "series_end" && gameMode === "playing") {
      // Start countdown when series ends
      setRematchCountdown(REMATCH_TIMEOUT_SECONDS)

      const interval = setInterval(() => {
        setRematchCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    } else {
      setRematchCountdown(null)
    }
  }, [phase, gameMode])

  useEffect(() => {
    if (phase === "select_target") {
      setHasVotedRematch(false)
    }
  }, [phase])

  useEffect(() => {
    if (phase === "select_target" && currentRound === 1) {
      setHasVotedRematch(false)
    }
  }, [phase, currentRound])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingGameLobby) {
        setGameStartedWhileAway(true)
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [pendingGameLobby])

  const handleGameStart = useCallback(
    async (lobby: Lobby) => {
      if (document.visibilityState !== "visible") {
        // User is away, store the lobby for when they return
        setPendingGameLobby(lobby)
        return
      }

      console.log("[v0] handleGameStart lobby:", {
        maxPlayers: lobby.maxPlayers,
        roundsToWin: lobby.roundsToWin,
        playerCount: lobby.players?.length,
        status: lobby.status,
      })

      setCurrentLobby(lobby)
      setSelectedRoundsToWin(lobby.roundsToWin)
      const playerCount = lobby.maxPlayers || lobby.players?.length || 4
      console.log("[v0] Setting selectedPlayerCount to:", playerCount)
      setSelectedPlayerCount(playerCount)
      setGameMode("playing")
      lastVersionRef.current = 0
      setHasVotedRematch(false)

      try {
        const result = await pollGameState(playerId)
        console.log("[v0] handleGameStart pollGameState result:", result)
        if (result && result.state && Array.isArray(result.state.players) && Array.isArray(result.state.cards)) {
          console.log("[v0] Setting sharedGameState with", result.state.players.length, "players")
          lastVersionRef.current = result.state.version
          setSharedGameState(result.state)
        } else {
          console.log("[v0] Invalid game state in handleGameStart:", result)
        }
      } catch (err) {
        console.error("[v0] Error in handleGameStart:", err)
        // Will be fetched on next poll
      }
    },
    [playerId],
  )

  const handleHostGame = useCallback(async () => {
    try {
      const result = await hostPrivateLobby(playerId, selectedRoundsToWin, selectedPlayerCount)
      setPrivateGameCode(result.gameCode)
      setIsHost(true)
      setGameMode("privateLobby")
    } catch (error) {
      console.error("[v0] Error hosting game:", error)
    }
  }, [playerId, selectedRoundsToWin, selectedPlayerCount])

  const handleJoinWithCode = useCallback(async () => {
    if (joinCodeInput.length !== 4) {
      setJoinError("Please enter a 4-letter code")
      return
    }

    setIsJoining(true)
    setJoinError(null)

    try {
      const result = await joinByCode(playerId, joinCodeInput)
      if (result.success) {
        setPrivateGameCode(joinCodeInput.toUpperCase())
        setIsHost(false)
        const lobbyStatus = await getLobbyStatus(playerId)
        if (lobbyStatus) {
          setSelectedPlayerCount(lobbyStatus.maxPlayers || 4)
          setSelectedRoundsToWin(lobbyStatus.roundsToWin || 2)
        }
        setGameMode("privateLobby")
      } else {
        setJoinError(result.error || "Failed to join game")
      }
    } catch (error) {
      setJoinError("Failed to join game")
    } finally {
      setIsJoining(false)
    }
  }, [playerId, joinCodeInput])

  const handleSelectTarget = useCallback(
    (targetId: string) => {
      if (phase !== "select_target") return
      const currentPlayer = players[currentPlayerIndex]
      if (currentPlayer?.id !== playerId) return
      setLocalSelectedTarget(targetId)
      selectTarget(playerId, targetId)
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

      const newState = await selectCard(playerId, cardId, targetToUse)
      if (newState && isMountedRef.current && Array.isArray(newState.players) && Array.isArray(newState.cards)) {
        lastVersionRef.current = newState.version
        setSharedGameState(newState)
        setLocalSelectedTarget(null)
      }
    },
    [phase, players, currentPlayerIndex, playerId, localSelectedTarget, targetPlayerId],
  )

  const handlePlayAgain = useCallback(async () => {
    if (currentLobby) {
      await sendHeartbeat(playerId)
    }
    setShowLeaveModal(false)
    setSharedGameState(null)
    setCurrentLobby(null)
    setPlayerReactions({})
    setTurnTimeRemaining(null)
    setGameStartCountdown(null)
    lastVersionRef.current = 0
    setLocalSelectedTarget(null)
    setHasVotedRematch(false)
    setGameMode("menu")
  }, [currentLobby, playerId])

  const handleVoteRematch = useCallback(async () => {
    if (hasVotedRematch) return
    setHasVotedRematch(true)
    try {
      await voteForRematch(playerId) // Changed function name
    } catch {
      setHasVotedRematch(false)
    }
  }, [playerId, hasVotedRematch])

  const handleJoinPendingGame = async () => {
    if (pendingGameLobby) {
      setCurrentLobby(pendingGameLobby)
      setGameMode("playing")
      const state = await pollGameState(playerId)
      if (state) {
        setSharedGameState(state)
      }
      setPendingGameLobby(null)
      setGameStartedWhileAway(false)
    }
  }

  const handleDismissPendingGame = async () => {
    await sendHeartbeat(playerId)
    setPendingGameLobby(null)
    setGameStartedWhileAway(false)
    setGameMode("menu")
  }

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

  const getGameModeText = (rounds: number) => {
    if (rounds === 1) return "Single Round"
    if (rounds === 2) return "Best of 3"
    if (rounds === 3) return "Best of 5"
    return "Best of 3"
  }

  const handleSendEmoji = useCallback(
    async (emoji: string) => {
      console.log("[v0] Sending emoji:", emoji, "from player:", playerId)
      await sendEmojiReaction(playerId, emoji)
    },
    [playerId],
  )

  // Round end screen
  if (phase === "round_end" && roundWinner && gameMode === "playing") {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
        <div className="bg-[#0f0a05] border-2 border-amber-800/60 p-8 sm:p-10 rounded-3xl text-center max-w-md w-full shadow-[0_0_100px_rgba(217,119,6,0.2)]">
          <h2 className="font-serif text-2xl sm:text-3xl text-amber-600 mb-4 tracking-widest uppercase">
            Round {currentRound} Complete
          </h2>
          <div className="relative inline-block mb-6">
            <img
              src={roundWinner.avatar || "/placeholder.svg"}
              alt={roundWinner.name}
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-amber-700 shadow-2xl object-cover"
            />
          </div>
          <p className="text-lg sm:text-xl text-amber-50/80 mb-4 font-serif font-light tracking-wide italic">
            {roundWinner.name} wins this round!
          </p>
          <div className="flex justify-center gap-4 mb-6">
            {sharedGameState?.players.map((p) => (
              <div key={p.id} className="text-center">
                <img
                  src={p.avatar || "/placeholder.svg"}
                  alt={p.name}
                  className="w-10 h-10 rounded-full border-2 border-amber-700/50 mx-auto mb-1"
                />
                <p className="text-amber-500/60 text-xs">{p.seriesWins} wins</p>
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
          {rematchCountdown !== null && rematchCountdown > 0 && (
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span
                className={`font-mono text-lg font-bold ${
                  rematchCountdown <= 10 ? "text-red-500 animate-pulse" : "text-amber-500"
                }`}
              >
                {rematchCountdown}s
              </span>
            </div>
          )}
          <h2 className="font-serif text-2xl sm:text-3xl text-amber-600 mb-2 tracking-widest uppercase">
            {roundsToWin === 1 ? "Game Complete" : "Series Complete"}
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
            {roundsToWin > 1 && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {Array.from({ length: roundsToWin }).map((_, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-amber-300 shadow-lg"
                  />
                ))}
              </div>
            )}
          </div>
          <p className="text-lg sm:text-xl text-amber-50/80 mb-8 font-serif font-light tracking-wide italic">
            {seriesWinner.name} wins{roundsToWin === 1 ? " the game" : " the series"}!
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleVoteRematch}
              disabled={hasVotedRematch || rematchCountdown === 0}
              className={`relative w-full px-8 py-4 rounded-2xl font-bold transition-all font-serif tracking-widest border shadow-xl ${
                hasVotedRematch || rematchCountdown === 0
                  ? "bg-amber-900/20 text-amber-500/60 border-amber-700/30 cursor-default opacity-50"
                  : "bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 border-amber-700/50"
              }`}
            >
              {rematchCountdown === 0
                ? "Voting Closed"
                : hasVotedRematch
                  ? "Waiting for others..."
                  : "Play Again (Same Players)"}
              {voterAvatars.length > 0 && rematchCountdown !== 0 && (
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
                {rematchCountdown === 0
                  ? "Not enough votes to play again..."
                  : `${rematchVotes.length} of ${humanPlayers.length} voted to rematch`}
              </p>
            )}

            <button
              onClick={handlePlayAgain}
              className="w-full px-8 py-4 bg-amber-900/20 hover:bg-amber-900/40 text-amber-200/90 text-base sm:text-lg rounded-2xl font-bold transition-all duration-200 font-serif tracking-widest border-2 border-amber-700/40 hover:border-amber-600/60 shadow-xl hover:shadow-amber-900/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              Find New Game
            </button>

            <div className="mt-6 pt-6 border-t border-amber-900/30">
              <p className="text-amber-200/60 text-sm font-serif mb-3">Enjoying the game? Consider donating.</p>
              <a
                href="https://buy.stripe.com/aFa5kEdUw24aecBewpbsc0b"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full px-8 py-3 bg-amber-700/30 hover:bg-amber-700/50 text-amber-200 text-sm rounded-xl font-bold transition-all text-center font-serif tracking-widest border border-amber-600/50 shadow-lg hover:shadow-amber-900/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                Donate Now
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameMode === "offline") {
    return <OfflineGame onBack={() => setGameMode("menu")} />
  }

  if (gameMode === "matchmaking") {
    return (
      <MatchmakingScreen
        playerId={playerId}
        onGameStart={handleGameStart}
        roundsToWin={selectedRoundsToWin}
        maxPlayers={selectedPlayerCount}
        onLeave={() => setGameMode("menu")}
      />
    )
  }

  if (gameMode === "playerSelection") {
    const fourPlayerTotal = lobbyStats
      ? lobbyStats.fourPlayer.single + lobbyStats.fourPlayer.bestOf3 + lobbyStats.fourPlayer.bestOf5
      : 0
    const eightPlayerTotal = lobbyStats
      ? lobbyStats.eightPlayer.single + lobbyStats.eightPlayer.bestOf3 + lobbyStats.eightPlayer.bestOf5
      : 0

    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-start pt-[20vh] relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.05)_0%,_#050505_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(180,83,9,0.08)_0%,_transparent_50%)]" />

        <div className="relative z-10 text-center max-w-lg w-full">
          <div className="mb-6">
            <LiveStats />
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl text-amber-700 tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
            FIND MATCH
          </h1>
          <p className="text-amber-100/70 font-serif text-base mb-8">How many players?</p>

          <div className="flex flex-col gap-4 mb-8">
            <button
              onClick={() => {
                setSelectedPlayerCount(4)
                setGameMode("roundSelection")
              }}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 rounded-2xl font-bold transition-all transform hover:scale-105 font-serif border border-amber-700/50 shadow-xl flex flex-col items-center relative"
            >
              <span className="text-xl tracking-widest">4 Players</span>
              <span className="text-amber-500/70 text-sm font-normal mt-1">Faster games, quicker rounds</span>
              {fourPlayerTotal > 0 && (
                <span className="absolute top-2 right-3 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {fourPlayerTotal} waiting
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedPlayerCount(8)
                setGameMode("roundSelection")
              }}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 rounded-2xl font-bold transition-all transform hover:scale-105 font-serif border border-amber-700/50 shadow-xl flex flex-col items-center relative"
            >
              <span className="text-xl tracking-widest">8 Players</span>
              <span className="text-amber-500/70 text-sm font-normal mt-1">Longer games, more chaos</span>
              {eightPlayerTotal > 0 && (
                <span className="absolute top-2 right-3 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {eightPlayerTotal} waiting
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => setGameMode("menu")}
            className="text-amber-500/60 hover:text-amber-400 font-serif tracking-wide transition-colors"
          >
            ← Back to Menu
          </button>
        </div>
      </div>
    )
  }

  if (gameMode === "roundSelection") {
    const stats = selectedPlayerCount === 4 ? lobbyStats?.fourPlayer : lobbyStats?.eightPlayer

    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-start pt-[20vh] relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.05)_0%,_#050505_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(180,83,9,0.08)_0%,_transparent_50%)]" />

        <div className="relative z-10 text-center max-w-lg w-full">
          <div className="mb-6">
            <LiveStats />
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl text-amber-700 tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
            FIND MATCH
          </h1>
          <p className="text-amber-100/70 font-serif text-base mb-2">Select game length</p>
          <p className="text-amber-500/60 text-sm mb-8">{selectedPlayerCount} Players</p>

          <div className="flex flex-col gap-4 mb-8">
            <button
              onClick={async () => {
                setSelectedRoundsToWin(1)
                setGameMode("matchmaking")
                try {
                  await joinMatchmaking(playerId, 1, selectedPlayerCount)
                } catch (error) {
                  console.error("[v0] Error joining matchmaking:", error)
                  setGameMode("menu")
                }
              }}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xl rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/50 shadow-xl relative"
            >
              Single Round
              {stats?.single ? (
                <span className="absolute top-2 right-3 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {stats.single} waiting
                </span>
              ) : null}
            </button>

            <button
              onClick={async () => {
                setSelectedRoundsToWin(2)
                setGameMode("matchmaking")
                try {
                  await joinMatchmaking(playerId, 2, selectedPlayerCount)
                } catch (error) {
                  console.error("[v0] Error joining matchmaking:", error)
                  setGameMode("menu")
                }
              }}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xl rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/50 shadow-xl relative"
            >
              Best of 3
              {stats?.bestOf3 ? (
                <span className="absolute top-2 right-3 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {stats.bestOf3} waiting
                </span>
              ) : null}
            </button>

            <button
              onClick={async () => {
                setSelectedRoundsToWin(3)
                setGameMode("matchmaking")
                try {
                  await joinMatchmaking(playerId, 3, selectedPlayerCount)
                } catch (error) {
                  console.error("[v0] Error joining matchmaking:", error)
                  setGameMode("menu")
                }
              }}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xl rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/50 shadow-xl relative"
            >
              Best of 5
              {stats?.bestOf5 ? (
                <span className="absolute top-2 right-3 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {stats.bestOf5} waiting
                </span>
              ) : null}
            </button>
          </div>

          <button
            onClick={() => setGameMode("playerSelection")}
            className="text-amber-500/60 hover:text-amber-400 font-serif tracking-wide transition-colors"
          >
            ← Back to Player Selection
          </button>
        </div>
      </div>
    )
  }

  if (gameMode === "hostOrJoin") {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-start pt-[20vh] relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.05)_0%,_#050505_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(180,83,9,0.08)_0%,_transparent_50%)]" />

        <div className="relative z-10 text-center max-w-lg w-full">
          <h1 className="font-serif text-4xl sm:text-5xl text-amber-700 tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
            PRIVATE GAME
          </h1>
          <p className="text-amber-100/70 font-serif text-base mb-8">Create or join a private game</p>

          <div className="flex flex-col gap-4 mb-8">
            <button
              onClick={() => setGameMode("hostPlayerSelection")}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 rounded-2xl font-bold transition-all transform hover:scale-105 font-serif border border-amber-700/50 shadow-xl flex flex-col items-center gap-1"
            >
              <span className="text-xl">Host Game</span>
              <span className="text-sm font-normal text-amber-400/70 tracking-wide">
                Create a private game and invite friends
              </span>
            </button>

            <button
              onClick={() => setGameMode("joinWithCode")}
              className="w-full px-12 py-5 bg-black/40 hover:bg-black/60 text-amber-200/80 rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/30 shadow-xl flex flex-col items-center gap-1"
            >
              <span className="text-xl">Join Game</span>
              <span className="text-sm font-normal text-amber-400/50 tracking-wide">
                Enter a code to join a friend's game
              </span>
            </button>
          </div>

          <button
            onClick={() => setGameMode("menu")}
            className="text-amber-500/60 hover:text-amber-400 font-serif tracking-wide transition-colors"
          >
            ← Back to Menu
          </button>
        </div>
      </div>
    )
  }

  if (gameMode === "joinWithCode") {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-start pt-[20vh] relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.05)_0%,_#050505_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(180,83,9,0.08)_0%,_transparent_50%)]" />

        <div className="relative z-10 text-center max-w-lg w-full">
          <h1 className="font-serif text-4xl sm:text-5xl text-amber-700 tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
            JOIN GAME
          </h1>
          <p className="text-amber-100/70 font-serif text-base mb-8">Enter the 4-letter code from your host</p>

          <div className="bg-black/60 backdrop-blur-xl border border-amber-900/40 rounded-2xl p-8 mb-6">
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => {
                const val = e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, "")
                  .slice(0, 4)
                setJoinCodeInput(val)
                setJoinError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && joinCodeInput.length === 4 && !isJoining) {
                  handleJoinWithCode()
                }
              }}
              placeholder="XXXX"
              className="w-full text-center text-4xl font-mono font-bold tracking-[0.5em] bg-black/50 border-2 border-amber-700/50 rounded-xl py-4 text-amber-500 placeholder:text-amber-900/50 focus:outline-none focus:border-amber-600"
              maxLength={4}
              autoFocus
            />

            {joinError && <p className="text-red-400 text-sm mt-3">{joinError}</p>}

            <button
              onClick={handleJoinWithCode}
              disabled={joinCodeInput.length !== 4 || isJoining}
              className="w-full mt-6 px-12 py-4 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-lg rounded-xl font-bold transition-all font-serif tracking-widest border border-amber-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? "Joining..." : "Join Game"}
            </button>
          </div>

          <button
            onClick={() => {
              setJoinCodeInput("")
              setJoinError(null)
              setGameMode("hostOrJoin")
            }}
            className="text-amber-500/60 hover:text-amber-400 font-serif tracking-wide transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  if (gameMode === "hostPlayerSelection") {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-start pt-[20vh] relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.05)_0%,_#050505_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(180,83,9,0.08)_0%,_transparent_50%)]" />

        <div className="relative z-10 text-center max-w-lg w-full">
          <h1 className="font-serif text-4xl sm:text-5xl text-amber-700 tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
            HOST GAME
          </h1>
          <p className="text-amber-100/70 font-serif text-base mb-8">How many players?</p>

          <div className="flex flex-col gap-4 mb-8">
            <button
              onClick={() => {
                setSelectedPlayerCount(4)
                setGameMode("hostRoundSelection")
              }}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 rounded-2xl font-bold transition-all transform hover:scale-105 font-serif border border-amber-700/50 shadow-xl flex flex-col items-center"
            >
              <span className="text-xl tracking-widest">4 Players</span>
              <span className="text-amber-500/70 text-sm font-normal mt-1">Faster games, quicker rounds</span>
            </button>

            <button
              onClick={() => {
                setSelectedPlayerCount(8)
                setGameMode("hostRoundSelection")
              }}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 rounded-2xl font-bold transition-all transform hover:scale-105 font-serif border border-amber-700/50 shadow-xl flex flex-col items-center"
            >
              <span className="text-xl tracking-widest">8 Players</span>
              <span className="text-amber-500/70 text-sm font-normal mt-1">Longer games, more chaos</span>
            </button>
          </div>

          <button
            onClick={() => setGameMode("hostOrJoin")}
            className="text-amber-500/60 hover:text-amber-400 font-serif tracking-wide transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  if (gameMode === "hostRoundSelection") {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-start pt-[20vh] relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.05)_0%,_#050505_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(180,83,9,0.08)_0%,_transparent_50%)]" />

        <div className="relative z-10 text-center max-w-lg w-full">
          <h1 className="font-serif text-4xl sm:text-5xl text-amber-700 tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
            HOST GAME
          </h1>
          <p className="text-amber-100/70 font-serif text-base mb-2">Select game length</p>
          <p className="text-amber-500/60 text-sm mb-8">{selectedPlayerCount} Players</p>

          <div className="flex flex-col gap-4 mb-8">
            <button
              onClick={() => {
                setSelectedRoundsToWin(1)
                handleHostGame()
              }}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xl rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/50 shadow-xl"
            >
              Single Round
            </button>

            <button
              onClick={() => {
                setSelectedRoundsToWin(2)
                handleHostGame()
              }}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xl rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/50 shadow-xl"
            >
              Best of 3
            </button>

            <button
              onClick={() => {
                setSelectedRoundsToWin(3)
                handleHostGame()
              }}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xl rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/50 shadow-xl"
            >
              Best of 5
            </button>
          </div>

          <button
            onClick={() => setGameMode("hostPlayerSelection")}
            className="text-amber-500/60 hover:text-amber-400 font-serif tracking-wide transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  if (gameMode === "privateLobby") {
    return (
      <PrivateLobbyScreen
        playerId={playerId}
        gameCode={privateGameCode}
        isHost={isHost}
        maxPlayers={selectedPlayerCount}
        roundsToWin={selectedRoundsToWin}
        onGameStart={(lobby) => {
          setCurrentLobby(lobby)
          setGameMode("playing")
          // Directly call hostStartGame here
          if (isHost) {
            hostStartGame(playerId, lobby.gameCode)
          }
        }}
        onLeave={() => {
          if (privateGameCode) {
            leaveLobby(playerId, privateGameCode)
          }
          setPrivateGameCode("")
          setIsHost(false)
          setJoinCodeInput("")
          setGameMode("menu")
        }}
      />
    )
  }

  // ... existing code for other game modes ...

  if (gameMode === "menu") {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-start pt-[15vh] relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.05)_0%,_#050505_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(180,83,9,0.08)_0%,_transparent_50%)]" />

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-amber-500/30 rounded-full animate-pulse" />
          <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-amber-600/20 rounded-full animate-pulse delay-300" />
          <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-amber-400/25 rounded-full animate-pulse delay-700" />
          <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-amber-500/20 rounded-full animate-pulse delay-500" />
        </div>

        <div className="relative z-10 text-center max-w-lg w-full">
          <div className="mb-6">
            <LiveStats />
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-amber-700 tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
            HIDE & SEEK
          </h1>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-amber-600 tracking-widest mb-6">CARDS</h2>

          <div className="mb-6">
            <AnimatedCardPreview />
            <p className="text-amber-200/50 text-xs mt-2 italic">Watch the cards reveal their secrets...</p>
          </div>

          <p className="text-amber-100/70 font-serif text-base sm:text-lg mb-8 leading-relaxed">
            A game of deception and fate. Four enter. One persists.
          </p>

          <div className="flex flex-col gap-4 mb-12">
            <button
              onClick={() => setGameMode("playerSelection")}
              className="w-full px-12 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xl rounded-2xl font-bold transition-all transform hover:scale-105 font-serif border border-amber-700/50 shadow-xl"
            >
              Find Match
            </button>
            <button
              onClick={() => setGameMode("hostOrJoin")}
              className="w-full px-12 py-4 bg-amber-800/30 hover:bg-amber-700/40 text-amber-200/90 text-lg rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/40 shadow-xl"
            >
              Host / Join Game
            </button>
            <button
              onClick={() => setGameMode("offline")}
              className="w-full px-12 py-4 bg-black/40 hover:bg-black/60 text-amber-200/80 text-lg rounded-2xl font-bold transition-all transform hover:scale-105 font-serif tracking-widest border border-amber-700/30 shadow-xl"
            >
              Play Offline
            </button>
          </div>

          <div className="space-y-4">
            <details className="bg-black/60 backdrop-blur-xl border border-amber-900/30 rounded-xl group">
              <summary className="font-serif text-amber-500 text-lg font-bold tracking-wider uppercase p-6 cursor-pointer list-none flex items-center justify-between hover:text-amber-400 transition-colors">
                How to Play
                <span className="text-amber-600 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-6 pb-6 pt-0 border-t border-amber-900/30">
                <ul className="text-amber-200/80 text-sm space-y-2 text-left leading-relaxed mt-4">
                  <li>• Everyone gets a secret card - but you don&apos;t know which one is yours!</li>
                  <li>• On your turn, select a target player to hunt</li>
                  <li>• Then flip one card from the center</li>
                  <li>• Find your target&apos;s card? They&apos;re eliminated!</li>
                  <li>• Flip your own card? You eliminate yourself!</li>
                  <li>• Flip someone else&apos;s card? Turn passes</li>
                  <li>• Last player standing wins the round!</li>
                  {roundsToWin > 1 && <li>• First to {roundsToWin} round wins takes the series!</li>}
                </ul>
              </div>
            </details>

            <details className="bg-black/60 backdrop-blur-xl border border-amber-900/30 rounded-xl group">
              <summary className="font-serif text-amber-500 text-lg font-bold tracking-wider uppercase p-6 cursor-pointer list-none flex items-center justify-between hover:text-amber-400 transition-colors">
                Our Story
                <span className="text-amber-600 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-6 pb-6 pt-0 border-t border-amber-900/30">
                <p className="text-amber-200/80 text-sm text-left leading-relaxed mt-4">
                  I built this game for my kids. They are actually the creators of this game and invented it on one of
                  our family camping trips. We all had so much fun playing it, I wanted to bring the joy of the game to
                  everyone.
                </p>
                <p className="text-amber-200/80 text-sm text-left leading-relaxed mt-3 italic">
                  I hope you have fun playing, Hide and Seek Cards.
                </p>

                <div className="mt-4 pt-4 border-t border-amber-900/30">
                  <p className="text-amber-200/60 text-sm text-center mb-3">Enjoying the game? Consider donating.</p>
                  <a
                    href="https://buy.stripe.com/aFa5kEdUw24aecBewpbsc0b"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full px-6 py-3 bg-amber-700/30 hover:bg-amber-700/50 text-amber-200 text-sm rounded-xl font-bold transition-all text-center font-serif tracking-widest border border-amber-600/50 shadow-lg hover:shadow-amber-900/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Donate Now
                  </a>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    )
  }

  if (gameStartedWhileAway && pendingGameLobby) {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.03)_0%,_#050505_80%)] opacity-50"></div>

        <div className="relative z-10 bg-black/90 backdrop-blur-xl border-2 border-amber-900/40 rounded-2xl p-8 max-w-md w-full text-center">
          <h2 className="font-serif text-2xl sm:text-3xl text-amber-700 mb-4 tracking-widest">GAME STARTED</h2>
          <p className="text-amber-100/80 font-serif mb-8">
            The game has started while you were away. Would you like to join?
          </p>

          <div className="flex flex-col gap-4">
            <button
              onClick={handleJoinPendingGame}
              className="w-full px-8 py-4 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-lg rounded-xl font-bold transition-all font-serif tracking-widest border border-amber-700/50"
            >
              Join Game
            </button>
            <button
              onClick={handleDismissPendingGame}
              className="w-full px-8 py-3 bg-black/40 hover:bg-black/60 text-amber-200/80 hover:text-amber-200 text-base rounded-xl font-bold transition-all font-serif tracking-widest border border-amber-900/30"
            >
              Exit to Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render the main game interface or menu if no specific game mode is active
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
              {roundsToWin === 1 ? "Single Round" : `Round ${currentRound} of ${getGameModeText(roundsToWin)}`}
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
          {/* Top player (position 4 - North) */}
          <div className="absolute -top-2 sm:top-0 md:top-2 left-1/2 -translate-x-1/2 z-30">
            {getVisualPlayer(4) && (
              <PlayerSeat
                player={getVisualPlayer(4)!}
                isActive={isVisualPositionActive(4)}
                isTarget={(localSelectedTarget || targetPlayerId) === getVisualPlayer(4)?.id}
                canBeTargeted={
                  phase === "select_target" &&
                  !isVisualPositionActive(4) &&
                  players[currentPlayerIndex]?.id === playerId
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={isVisualPositionActive(4) ? turnTimeRemaining : null}
                displayedEmoji={playerReactions[getVisualPlayer(4)?.id || ""]}
                seriesWins={sharedGameState?.players.find((p) => p.id === getVisualPlayer(4)?.id)?.seriesWins || 0}
                size={selectedPlayerCount === 4 ? "normal" : "small"}
              />
            )}
          </div>

          {/* Top-right player (position 5 - Northeast) */}
          <div className="absolute top-6 sm:top-10 md:top-12 right-4 sm:right-8 md:right-16 z-30">
            {getVisualPlayer(5) && (
              <PlayerSeat
                player={getVisualPlayer(5)!}
                isActive={isVisualPositionActive(5)}
                isTarget={(localSelectedTarget || targetPlayerId) === getVisualPlayer(5)?.id}
                canBeTargeted={
                  phase === "select_target" &&
                  !isVisualPositionActive(5) &&
                  players[currentPlayerIndex]?.id === playerId
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={isVisualPositionActive(5) ? turnTimeRemaining : null}
                displayedEmoji={playerReactions[getVisualPlayer(5)?.id || ""]}
                seriesWins={sharedGameState?.players.find((p) => p.id === getVisualPlayer(5)?.id)?.seriesWins || 0}
                size={selectedPlayerCount === 4 ? "normal" : "small"}
              />
            )}
          </div>

          {/* Right player (position 6 - East) */}
          <div className="absolute top-1/2 -translate-y-1/2 right-0 sm:right-2 md:right-6 z-30">
            {getVisualPlayer(6) && (
              <PlayerSeat
                player={getVisualPlayer(6)!}
                isActive={isVisualPositionActive(6)}
                isTarget={(localSelectedTarget || targetPlayerId) === getVisualPlayer(6)?.id}
                canBeTargeted={
                  phase === "select_target" &&
                  !isVisualPositionActive(6) &&
                  players[currentPlayerIndex]?.id === playerId
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={isVisualPositionActive(6) ? turnTimeRemaining : null}
                displayedEmoji={playerReactions[getVisualPlayer(6)?.id || ""]}
                seriesWins={sharedGameState?.players.find((p) => p.id === getVisualPlayer(6)?.id)?.seriesWins || 0}
                size={selectedPlayerCount === 4 ? "normal" : "small"}
              />
            )}
          </div>

          {/* Bottom-right player (position 7 - Southeast) */}
          <div className="absolute bottom-6 sm:bottom-10 md:bottom-12 right-4 sm:right-8 md:right-16 z-30">
            {getVisualPlayer(7) && (
              <PlayerSeat
                player={getVisualPlayer(7)!}
                isActive={isVisualPositionActive(7)}
                isTarget={(localSelectedTarget || targetPlayerId) === getVisualPlayer(7)?.id}
                canBeTargeted={
                  phase === "select_target" &&
                  !isVisualPositionActive(7) &&
                  players[currentPlayerIndex]?.id === playerId
                }
                onSelectTarget={handleSelectTarget}
                turnTimeRemaining={isVisualPositionActive(7) ? turnTimeRemaining : null}
                displayedEmoji={playerReactions[getVisualPlayer(7)?.id || ""]}
                seriesWins={sharedGameState?.players.find((p) => p.id === getVisualPlayer(7)?.id)?.seriesWins || 0}
                size={selectedPlayerCount === 4 ? "normal" : "small"}
              />
            )}
          </div>

          {/* Bottom player (position 0 - South, local player) */}
          <div
            className={`absolute -bottom-2 sm:bottom-0 ${selectedPlayerCount === 4 ? "md:bottom-7" : "md:bottom-2"} left-1/2 -translate-x-1/2 z-30`}
          >
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
                isLocalPlayer={true}
                onSendEmoji={handleSendEmoji}
                size={selectedPlayerCount === 4 ? "normal" : "small"}
              />
            )}
          </div>

          {/* Bottom-left player (position 1 - Southwest) */}
          <div className="absolute bottom-6 sm:bottom-10 md:bottom-12 left-4 sm:left-8 md:left-16 z-30">
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
                size={selectedPlayerCount === 4 ? "normal" : "small"}
              />
            )}
          </div>

          {/* Left player (position 2 - West) */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 sm:left-2 md:left-6 z-30">
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
                size={selectedPlayerCount === 4 ? "normal" : "small"}
              />
            )}
          </div>

          {/* Top-left player (position 3 - Northwest) */}
          <div className="absolute top-6 sm:top-10 md:top-12 left-4 sm:left-8 md:left-16 z-30">
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
                size={selectedPlayerCount === 4 ? "normal" : "small"}
              />
            )}
          </div>

          {/* CHANGE START */}
          <div className="absolute inset-0 flex items-center justify-center mx-16 sm:mx-20 md:mx-24 lg:mx-28 my-20 sm:my-24 pointer-events-none z-20">
            {cards.length <= 4 ? (
              <>
                {/* Mobile: 2x2 layout for 4 or fewer cards */}
                <div className="sm:hidden grid grid-cols-2 gap-2 pointer-events-auto">
                  {cards.map((card) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      totalCards={cards.length}
                      canFlip={
                        (phase === "select_card" || phase === "select_target") &&
                        players[currentPlayerIndex]?.id === playerId &&
                        (!!localSelectedTarget || !!targetPlayerId)
                      }
                      onFlip={() => handlePickCard(card.id)}
                      playerAvatar={getCardPlayerAvatar(card)}
                      size="normal"
                    />
                  ))}
                </div>
                <div className="hidden sm:grid grid-cols-4 gap-4 md:gap-6 pointer-events-auto">
                  {cards.map((card) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      totalCards={cards.length}
                      canFlip={
                        (phase === "select_card" || phase === "select_target") &&
                        players[currentPlayerIndex]?.id === playerId &&
                        (!!localSelectedTarget || !!targetPlayerId)
                      }
                      onFlip={() => handlePickCard(card.id)}
                      playerAvatar={getCardPlayerAvatar(card)}
                      size="normal"
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Mobile: 3+3+2 layout for more than 4 cards - use flex rows */}
                <div className="sm:hidden flex flex-col gap-2 items-center pointer-events-auto">
                  {/* First row of 3 */}
                  <div className="flex gap-2">
                    {cards.slice(0, 3).map((card) => (
                      <CardComponent
                        key={card.id}
                        card={card}
                        totalCards={cards.length}
                        canFlip={
                          (phase === "select_card" || phase === "select_target") &&
                          players[currentPlayerIndex]?.id === playerId &&
                          (!!localSelectedTarget || !!targetPlayerId)
                        }
                        onFlip={() => handlePickCard(card.id)}
                        playerAvatar={getCardPlayerAvatar(card)}
                        size="small"
                      />
                    ))}
                  </div>
                  {/* Second row of 3 */}
                  <div className="flex gap-2">
                    {cards.slice(3, 6).map((card) => (
                      <CardComponent
                        key={card.id}
                        card={card}
                        totalCards={cards.length}
                        canFlip={
                          (phase === "select_card" || phase === "select_target") &&
                          players[currentPlayerIndex]?.id === playerId &&
                          (!!localSelectedTarget || !!targetPlayerId)
                        }
                        onFlip={() => handlePickCard(card.id)}
                        playerAvatar={getCardPlayerAvatar(card)}
                        size="small"
                      />
                    ))}
                  </div>
                  {/* Third row of 2 (centered) */}
                  {cards.length > 6 && (
                    <div className="flex gap-2">
                      {cards.slice(6).map((card) => (
                        <CardComponent
                          key={card.id}
                          card={card}
                          totalCards={cards.length}
                          canFlip={
                            (phase === "select_card" || phase === "select_target") &&
                            players[currentPlayerIndex]?.id === playerId &&
                            (!!localSelectedTarget || !!targetPlayerId)
                          }
                          onFlip={() => handlePickCard(card.id)}
                          playerAvatar={getCardPlayerAvatar(card)}
                          size="small"
                        />
                      ))}
                    </div>
                  )}
                </div>
                {/* Desktop/Tablet: 2x4 layout for 8 players */}
                <div className="hidden sm:grid grid-cols-4 gap-3 md:gap-4 pointer-events-auto">
                  {cards.map((card) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      totalCards={cards.length}
                      canFlip={
                        (phase === "select_card" || phase === "select_target") &&
                        players[currentPlayerIndex]?.id === playerId &&
                        (!!localSelectedTarget || !!targetPlayerId)
                      }
                      onFlip={() => handlePickCard(card.id)}
                      playerAvatar={getCardPlayerAvatar(card)}
                      size="small"
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          {/* CHANGE END */}
        </div>

        <div className="flex-shrink-0 flex justify-between items-center px-4 sm:px-8 py-3 sm:py-4">
          <button
            onClick={() => setShowRulesModal(true)}
            className="bg-black/40 hover:bg-black/60 text-amber-200/80 hover:text-amber-200 px-4 py-2 text-xs sm:text-sm rounded-lg font-serif tracking-wide transition-all duration-200 border border-amber-900/30 hover:border-amber-700/50 hover:scale-105 active:scale-95"
          >
            Rules
          </button>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="bg-red-900/30 hover:bg-red-900/50 text-red-200/80 hover:text-red-200 px-4 py-2 text-xs sm:text-sm rounded-lg font-serif tracking-wide transition-all duration-200 border border-red-900/30 hover:border-red-700/50 hover:scale-105 active:scale-95"
          >
            Leave
          </button>
        </div>
      </div>

      {showRulesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border-2 border-amber-900/40 p-6 sm:p-8 rounded-2xl max-w-md w-full">
            <h2 className="font-serif text-2xl sm:text-3xl text-amber-700 mb-6 tracking-widest">RULES</h2>
            <ul className="text-amber-200/80 text-sm space-y-3 text-left leading-relaxed mb-6">
              <li>• Everyone gets a secret card - but you don&apos;t know which one is yours!</li>
              <li>• On your turn, select a target player to hunt</li>
              <li>• Then flip one card from the center</li>
              <li>• Find your target&apos;s card? They&apos;re eliminated!</li>
              <li>• Flip your own card? You eliminate yourself!</li>
              <li>• Flip someone else&apos;s card? Turn passes</li>
              <li>• Last player standing wins the round!</li>
              {roundsToWin > 1 && <li>• First to {roundsToWin} round wins takes the series!</li>}
            </ul>
            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 py-3 rounded-xl font-bold font-serif tracking-widest border border-amber-700/50"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border-2 border-amber-900/40 p-6 sm:p-8 rounded-2xl max-w-md w-full text-center">
            <h2 className="font-serif text-2xl sm:text-3xl text-amber-700 mb-4 tracking-widest">Leave Game?</h2>
            <p className="text-amber-200/80 text-sm mb-6">
              If you leave, you&apos;ll be replaced by a bot and forfeit this game.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 bg-black/40 hover:bg-black/60 text-amber-200/80 hover:text-amber-200 py-3 rounded-xl font-bold font-serif tracking-widest border border-amber-900/30 hover:border-amber-700/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveGame}
                className="flex-1 bg-red-900/40 hover:bg-red-800/60 text-red-200 py-3 rounded-xl font-bold font-serif tracking-widest border border-red-700/50"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
