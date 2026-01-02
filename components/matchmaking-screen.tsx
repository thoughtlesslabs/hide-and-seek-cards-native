"use client"

import { useState, useEffect } from "react"
import type { Lobby, LobbyPlayer } from "@/types/multiplayer"
import { ALLOWED_EMOJIS } from "@/types/multiplayer"
import { joinMatchmaking, getLobbyStatus, sendEmojiReaction, leaveLobby } from "@/app/actions/multiplayer"

interface MatchmakingScreenProps {
  playerId: string
  onGameStart: (lobby: Lobby) => void
  roundsToWin: number // Added roundsToWin prop
}

export default function MatchmakingScreen({ playerId, onGameStart, roundsToWin }: MatchmakingScreenProps) {
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<LobbyPlayer | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [isLeaving, setIsLeaving] = useState(false)
  const [localEmoji, setLocalEmoji] = useState<string | null>(null)

  useEffect(() => {
    joinMatchmaking(playerId, roundsToWin).then((player) => {
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
  }, [playerId, onGameStart, roundsToWin])

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
    window.location.reload()
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

  if (!lobby || !currentPlayer) {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-amber-100 font-serif text-xl">Finding players...</p>
          <p className="text-amber-500/60 font-serif text-sm mt-2">{getGameModeText()}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.03)_0%,_#050505_80%)] opacity-50"></div>

      <div className="relative z-10 max-w-2xl w-full">
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-amber-700 tracking-widest text-center mb-2">
          MATCHMAKING
        </h1>
        <p className="text-amber-500/60 font-serif text-center mb-8">{getGameModeText()}</p>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lobby.players.map((player) => {
                const emoji = getPlayerEmoji(player.id)
                return (
                  <div
                    key={player.id}
                    className="bg-black/60 border border-amber-900/30 rounded-xl p-4 flex items-center gap-3 relative"
                  >
                    <div className="relative">
                      {emoji && (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-3xl animate-bounce z-10">
                          {emoji}
                        </span>
                      )}
                      <img
                        src={player.avatar || "/placeholder.svg"}
                        alt={player.username}
                        className="w-12 h-12 rounded-full border-2 border-amber-700"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-amber-100 font-serif truncate">{player.username}</p>
                      <p className="text-amber-700/60 text-xs uppercase">{player.isBot ? "Bot" : "Human"}</p>
                    </div>
                  </div>
                )
              })}
              {Array.from({ length: 4 - lobby.players.length }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="bg-black/30 border border-amber-900/20 rounded-xl p-4 flex items-center justify-center"
                >
                  <p className="text-amber-700/40 text-sm font-serif">Waiting...</p>
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
