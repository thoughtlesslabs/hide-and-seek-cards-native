"use client"

import { useState, useEffect } from "react"
import type { Lobby, LobbyPlayer } from "@/types/multiplayer"
import { ALLOWED_EMOJIS } from "@/types/multiplayer"
import { joinMatchmaking, getLobbyStatus, sendEmojiReaction, leaveLobby } from "@/app/actions/multiplayer"
import LiveStats from "@/components/live-stats"

interface MatchmakingScreenProps {
  playerId: string
  onGameStart: (lobby: Lobby) => void
  roundsToWin: number // Added roundsToWin prop
  maxPlayers: number // Added maxPlayers prop
  onLeave: () => void // Added onLeave prop
}

export default function MatchmakingScreen({
  playerId,
  onGameStart,
  roundsToWin,
  maxPlayers,
  onLeave,
}: MatchmakingScreenProps) {
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<LobbyPlayer | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [isLeaving, setIsLeaving] = useState(false)
  const [localEmoji, setLocalEmoji] = useState<string | null>(null)

  useEffect(() => {
    joinMatchmaking(playerId, roundsToWin, maxPlayers).then((player) => {
      setCurrentPlayer(player)
    })

    const interval = setInterval(async () => {
      const lobbyStatus = await getLobbyStatus(playerId)
      if (lobbyStatus) {
        setLobby(lobbyStatus)

        if (lobbyStatus.status === "in-progress") {
          onGameStart(lobbyStatus)
        }

        if (lobbyStatus.startTimer) {
          const remaining = Math.max(0, Math.ceil((lobbyStatus.startTimer - Date.now()) / 1000))
          setTimeRemaining(remaining)
        }
      }
    }, 500)

    return () => {
      clearInterval(interval)
      leaveLobby(playerId)
    }
  }, [playerId, onGameStart, roundsToWin, maxPlayers])

  const handleEmojiClick = async (emoji: string) => {
    // Show locally immediately
    setLocalEmoji(emoji)
    // Send to server
    await sendEmojiReaction(playerId, emoji)
    // Clear local emoji after 5 seconds
    setTimeout(() => {
      setLocalEmoji(null)
    }, 5000)
  }

  const handleLeaveQueue = async () => {
    setIsLeaving(true)
    await leaveLobby(playerId)
    onLeave()
  }

  const getPlayerEmoji = (pId: string): string | null => {
    // Local emoji takes priority for current player
    if (pId === playerId && localEmoji) {
      return localEmoji
    }
    // Check lobby reactions
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

  const getPlayerCountText = () => {
    return `${maxPlayers} Players`
  }

  if (!lobby || !currentPlayer) {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-amber-100 font-serif text-xl">Finding players...</p>
          <p className="text-amber-500/60 font-serif text-sm mt-2">
            {getGameModeText()} • {getPlayerCountText()}
          </p>
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

        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-amber-700 tracking-widest mb-4 drop-shadow-[0_0_30px_rgba(180,83,9,0.6)]">
          FINDING MATCH
        </h1>
        <p className="text-amber-500/60 font-serif mb-8">
          {getGameModeText()} • {getPlayerCountText()}
        </p>

        <div className="bg-black/90 backdrop-blur-xl border-2 border-amber-900/40 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-amber-100 text-lg font-serif mb-1">Your identity:</p>
              <p className="text-amber-500 text-2xl font-bold font-serif">{currentPlayer.username}</p>
            </div>
            {lobby.startTimer && (
              <div className="text-center">
                <div className="text-amber-700 text-4xl font-bold font-mono">{timeRemaining}s</div>
                <p className="text-amber-500/60 text-sm uppercase tracking-wide">Time Left</p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <p className="text-amber-100/80 text-sm mb-4 font-serif">
              {lobby.status === "waiting" ? "Waiting for players... Bots will join if needed." : "Game starting soon!"}
            </p>
            <div
              className={`flex flex-col gap-2 sm:grid ${maxPlayers === 4 ? "sm:grid-cols-4" : "sm:grid-cols-4"} sm:gap-3 md:gap-4`}
            >
              {lobby.players.map((player) => {
                const emoji = getPlayerEmoji(player.id)
                return (
                  <div
                    key={player.id}
                    className="bg-black/60 border border-amber-900/30 rounded-xl p-2 sm:p-3 flex flex-row sm:flex-col items-center gap-3 sm:gap-0 relative"
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

        <button
          onClick={handleLeaveQueue}
          disabled={isLeaving}
          className="w-full bg-red-900/40 hover:bg-red-800/60 text-red-200 py-3 rounded-xl font-bold transition-all font-serif tracking-wide border border-red-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLeaving ? "Leaving..." : "Leave Queue"}
        </button>
      </div>
    </div>
  )
}
