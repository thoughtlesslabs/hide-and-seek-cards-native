"use client"

import { useState, useEffect } from "react"
import type { Lobby, LobbyPlayer } from "@/types/multiplayer"
import { ALLOWED_EMOJIS } from "@/types/multiplayer"
import { getLobbyStatus, sendEmojiReaction, leaveLobby, hostStartGame } from "@/app/actions/multiplayer"
import LiveStats from "@/components/live-stats"

interface PrivateLobbyScreenProps {
  playerId: string
  gameCode: string
  isHost: boolean
  onGameStart: (lobby: Lobby) => void
  onLeave: () => void
  maxPlayers?: number
  roundsToWin?: number
}

export default function PrivateLobbyScreen({
  playerId,
  gameCode,
  isHost,
  onGameStart,
  onLeave,
  maxPlayers: propMaxPlayers,
  roundsToWin: propRoundsToWin,
}: PrivateLobbyScreenProps) {
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<LobbyPlayer | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [localEmoji, setLocalEmoji] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const maxPlayers = lobby?.maxPlayers || propMaxPlayers || 4
  const roundsToWin = lobby?.roundsToWin || propRoundsToWin || 2

  useEffect(() => {
    const interval = setInterval(async () => {
      const lobbyStatus = await getLobbyStatus(playerId)
      if (lobbyStatus) {
        setLobby(lobbyStatus)

        const player = lobbyStatus.players.find((p) => p.id === playerId)
        if (player) {
          setCurrentPlayer(player)
        }

        if (lobbyStatus.status === "in-progress") {
          onGameStart(lobbyStatus)
        }
      }
    }, 500)

    return () => {
      clearInterval(interval)
    }
  }, [playerId, onGameStart])

  const handleEmojiClick = async (emoji: string) => {
    setLocalEmoji(emoji)
    await sendEmojiReaction(playerId, emoji)
    setTimeout(() => {
      setLocalEmoji(null)
    }, 5000)
  }

  const handleLeaveQueue = async () => {
    setIsLeaving(true)
    await leaveLobby(playerId)
    onLeave()
  }

  const handleStartGame = async () => {
    setIsStarting(true)
    setStartError(null)
    const result = await hostStartGame(playerId)
    if (!result.success) {
      setStartError(result.error || "Failed to start game")
      setIsStarting(false)
    }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(gameCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textArea = document.createElement("textarea")
      textArea.value = gameCode
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getPlayerEmoji = (pId: string): string | null => {
    if (pId === playerId && localEmoji) {
      return localEmoji
    }
    if (lobby?.reactions && lobby.reactions[pId]) {
      const reaction = lobby.reactions[pId]
      const age = Date.now() - reaction.timestamp
      if (age < 5000) {
        return reaction.emoji
      }
    }
    return null
  }

  const getGameModeText = () => {
    if (roundsToWin === 1) return "Single Round"
    if (roundsToWin === 2) return "Best of 3"
    if (roundsToWin === 3) return "Best of 5"
    return "Best of 3"
  }

  const actuallyIsHost = lobby?.hostId === playerId

  if (!lobby || !currentPlayer) {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-amber-100 font-serif text-xl">Setting up private game...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.03)_0%,_#050505_80%)] opacity-50"></div>

      <div className="relative z-10 text-center max-w-lg w-full">
        <div className="mb-6">
          <LiveStats />
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-amber-700 tracking-widest mb-2 drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
          PRIVATE GAME
        </h1>
        <p className="text-amber-500/60 font-serif mb-4">
          {getGameModeText()} • {maxPlayers} Players
        </p>

        {/* Game Code Display */}
        <div className="bg-amber-900/30 border-2 border-amber-700/50 rounded-2xl p-4 mb-6">
          <p className="text-amber-100/80 text-sm mb-2 font-serif">Share this code with friends:</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl sm:text-5xl font-mono font-bold text-amber-500 tracking-[0.3em]">{gameCode}</span>
            <button
              onClick={handleCopyCode}
              className="px-3 py-2 bg-amber-800/50 hover:bg-amber-700/50 text-amber-200 rounded-lg text-sm transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="bg-black/90 backdrop-blur-xl border-2 border-amber-900/40 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-amber-100 text-lg font-serif mb-1">Your identity:</p>
              <p className="text-amber-500 text-2xl font-bold font-serif">{currentPlayer.username}</p>
            </div>
            {actuallyIsHost && (
              <div className="bg-amber-700/30 px-3 py-1 rounded-full">
                <span className="text-amber-400 text-sm font-serif">HOST</span>
              </div>
            )}
          </div>

          <div className="mb-6">
            <p className="text-amber-100/80 text-sm mb-4 font-serif">
              {lobby.players.length}/{maxPlayers} players joined
              {actuallyIsHost ? " • Press Start when ready" : " • Waiting for host to start"}
            </p>
            <div
              className={`flex flex-col gap-2 sm:grid ${maxPlayers === 4 ? "sm:grid-cols-4" : "sm:grid-cols-4"} sm:gap-3 md:gap-4`}
            >
              {lobby.players.map((player) => {
                const emoji = getPlayerEmoji(player.id)
                const isHostPlayer = player.id === lobby.hostId
                return (
                  <div
                    key={player.id}
                    className={`bg-black/60 border rounded-xl p-2 sm:p-3 flex flex-row sm:flex-col items-center gap-3 sm:gap-0 relative ${
                      isHostPlayer ? "border-amber-500/50" : "border-amber-900/30"
                    }`}
                  >
                    <div className="relative sm:mb-2">
                      {emoji && (
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce z-10">
                          {emoji}
                        </span>
                      )}
                      <img
                        src={player.avatar || "/placeholder.svg"}
                        alt={player.username}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-amber-700 bg-white"
                      />
                      {isHostPlayer && (
                        <span className="absolute -bottom-1 -right-1 bg-amber-600 text-[8px] text-white px-1 rounded">
                          HOST
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-center">
                      <p className="text-amber-100 font-serif text-xs sm:text-sm truncate max-w-[120px] sm:max-w-full sm:w-full sm:text-center">
                        {player.username}
                      </p>
                      <p className="text-amber-700/60 text-[10px] sm:text-xs uppercase">
                        {player.isBot ? "Bot" : "Human"}
                      </p>
                    </div>
                  </div>
                )
              })}
              {Array.from({ length: maxPlayers - lobby.players.length }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="bg-black/30 border border-amber-900/20 rounded-xl p-2 sm:p-3 flex flex-row sm:flex-col items-center gap-3 sm:gap-0 sm:justify-center min-h-[56px] sm:min-h-[100px]"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-amber-900/20 border-dashed sm:mb-2"></div>
                  <p className="text-amber-700/40 text-xs font-serif">Waiting...</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-amber-100/80 text-sm mb-3 font-serif">Send a reaction:</p>
            <div className="flex flex-wrap gap-2">
              {ALLOWED_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-3xl hover:scale-125 transition-transform bg-black/40 border border-amber-900/20 rounded-lg p-2 hover:border-amber-700/50"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {startError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-xl">
            <p className="text-red-300 text-sm">{startError}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {actuallyIsHost && (
            <button
              onClick={handleStartGame}
              disabled={isStarting || lobby.players.length < 2}
              className="flex-1 bg-amber-700/60 hover:bg-amber-600/70 text-amber-100 py-3 rounded-xl font-bold transition-all font-serif tracking-wide border border-amber-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStarting ? "Starting..." : lobby.players.length < 2 ? "Need 2+ Players" : "Start Game"}
            </button>
          )}
          <button
            onClick={handleLeaveQueue}
            disabled={isLeaving}
            className={`${actuallyIsHost ? "flex-1" : "w-full"} bg-red-900/40 hover:bg-red-800/60 text-red-200 py-3 rounded-xl font-bold transition-all font-serif tracking-wide border border-red-700/50 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLeaving ? "Leaving..." : "Leave Game"}
          </button>
        </div>
      </div>
    </div>
  )
}
