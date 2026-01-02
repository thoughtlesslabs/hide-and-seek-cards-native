"use client"

import { useState, useEffect } from "react"
import type { Lobby, LobbyPlayer } from "@/types/multiplayer"
import { ALLOWED_EMOJIS } from "@/types/multiplayer"
import {
  createPrivateGame,
  joinPrivateGame,
  getLobbyStatus,
  sendEmojiReaction,
  leaveLobby,
  startPrivateGame,
} from "@/app/actions/multiplayer"

interface PrivateGameScreenProps {
  playerId: string
  onGameStart: (lobby: Lobby) => void
  onBack: () => void
}

export default function PrivateGameScreen({ playerId, onGameStart, onBack }: PrivateGameScreenProps) {
  const [mode, setMode] = useState<"select" | "host" | "join">("select")
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<LobbyPlayer | null>(null)
  const [roomCode, setRoomCode] = useState<string>("")
  const [inputCode, setInputCode] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localEmoji, setLocalEmoji] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  // Check URL for room code on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const urlRoomCode = params.get("room")
      if (urlRoomCode && urlRoomCode.length === 4) {
        setInputCode(urlRoomCode.toUpperCase())
        setMode("join")
      }
    }
  }, [])

  useEffect(() => {
    if (!lobby) return

    const interval = setInterval(async () => {
      const lobbyStatus = await getLobbyStatus(playerId)
      if (lobbyStatus) {
        setLobby(lobbyStatus)

        if (lobbyStatus.status === "in-progress") {
          onGameStart(lobbyStatus)
        }
      }
    }, 500)

    return () => {
      clearInterval(interval)
    }
  }, [lobby, playerId, onGameStart])

  const handleHost = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await createPrivateGame(playerId)
      if (result) {
        setCurrentPlayer(result.player)
        setRoomCode(result.roomCode)
        setMode("host")

        // Update URL with room code
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href)
          url.searchParams.set("room", result.roomCode)
          window.history.replaceState({}, "", url.toString())
        }

        // Start polling for lobby
        const lobbyStatus = await getLobbyStatus(playerId)
        if (lobbyStatus) {
          setLobby(lobbyStatus)
        }
      }
    } catch {
      setError("Failed to create game. Please try again.")
    }
    setIsLoading(false)
  }

  const handleJoin = async () => {
    if (inputCode.length !== 4) {
      setError("Please enter a 4-letter room code.")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const player = await joinPrivateGame(playerId, inputCode.toUpperCase())
      if (player) {
        setCurrentPlayer(player)
        setRoomCode(inputCode.toUpperCase())

        // Start polling for lobby
        const lobbyStatus = await getLobbyStatus(playerId)
        if (lobbyStatus) {
          setLobby(lobbyStatus)
        }
      } else {
        setError("Room not found or is full. Please check the code.")
      }
    } catch {
      setError("Failed to join game. Please try again.")
    }
    setIsLoading(false)
  }

  const handleStartGame = async () => {
    setIsStarting(true)
    try {
      const success = await startPrivateGame(playerId)
      if (!success) {
        setError("Failed to start game. Only the host can start.")
      }
    } catch {
      setError("Failed to start game.")
    }
    setIsStarting(false)
  }

  const handleLeave = async () => {
    await leaveLobby(playerId)
    // Clear URL params
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.delete("room")
      window.history.replaceState({}, "", url.toString())
    }
    onBack()
  }

  const handleEmojiClick = async (emoji: string) => {
    setLocalEmoji(emoji)
    await sendEmojiReaction(playerId, emoji)
    setTimeout(() => setLocalEmoji(null), 5000)
  }

  const getPlayerEmoji = (pId: string): string | null => {
    if (pId === playerId && localEmoji) return localEmoji
    if (lobby?.reactions && lobby.reactions[pId]) {
      const reaction = lobby.reactions[pId]
      const age = Date.now() - reaction.timestamp
      if (age < 5000) return reaction.emoji
    }
    return null
  }

  const copyShareLink = () => {
    if (typeof window !== "undefined" && roomCode) {
      const url = new URL(window.location.origin)
      url.searchParams.set("room", roomCode)
      navigator.clipboard.writeText(url.toString())
    }
  }

  const isHost = lobby?.players[0]?.id === playerId

  // Select mode screen
  if (mode === "select") {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.03)_0%,_#050505_80%)] opacity-50"></div>

        <div className="relative z-10 max-w-md w-full">
          <h1 className="font-serif text-3xl sm:text-4xl text-amber-700 tracking-widest text-center mb-8">
            PRIVATE GAME
          </h1>

          <div className="flex flex-col gap-4 mb-8">
            <button
              onClick={handleHost}
              disabled={isLoading}
              className="w-full px-8 py-5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-xl rounded-2xl font-bold transition-all font-serif tracking-widest border border-amber-700/50 shadow-xl disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Host Game"}
            </button>

            <div className="text-center text-amber-500/60 font-serif">or</div>

            <div className="bg-black/60 border border-amber-900/30 rounded-2xl p-6">
              <p className="text-amber-100 font-serif mb-3">Enter Room Code:</p>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="ABCD"
                maxLength={4}
                className="w-full text-center text-4xl font-bold font-mono tracking-[0.5em] bg-black/60 border-2 border-amber-700/50 rounded-xl py-4 text-amber-200 placeholder:text-amber-700/30 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleJoin}
                disabled={isLoading || inputCode.length !== 4}
                className="w-full mt-4 px-8 py-4 bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-lg rounded-xl font-bold transition-all font-serif tracking-widest border border-amber-700/50 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Joining..." : "Join Game"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4">
              <p className="text-red-200 text-center font-serif">{error}</p>
            </div>
          )}

          <button
            onClick={onBack}
            className="w-full bg-black/40 hover:bg-black/60 text-amber-200/80 py-3 rounded-xl font-bold transition-all font-serif tracking-wide border border-amber-700/30"
          >
            Back to Menu
          </button>
        </div>
      </div>
    )
  }

  // Waiting room (host or joined)
  return (
    <div className="min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(217,119,6,0.03)_0%,_#050505_80%)] opacity-50"></div>

      <div className="relative z-10 max-w-2xl w-full">
        <h1 className="font-serif text-3xl sm:text-4xl text-amber-700 tracking-widest text-center mb-4">
          PRIVATE GAME
        </h1>

        {roomCode && (
          <div className="text-center mb-6">
            <p className="text-amber-500/60 font-serif text-sm mb-2">Room Code</p>
            <div className="inline-flex items-center gap-3 bg-black/60 border-2 border-amber-700/50 rounded-xl px-6 py-3">
              <span className="text-4xl font-bold font-mono tracking-[0.3em] text-amber-200">{roomCode}</span>
              <button
                onClick={copyShareLink}
                className="text-amber-500 hover:text-amber-400 transition-colors"
                title="Copy share link"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
            <p className="text-amber-500/40 font-serif text-xs mt-2">Share this code with friends to join</p>
          </div>
        )}

        <div className="bg-black/90 backdrop-blur-xl border-2 border-amber-900/40 rounded-2xl p-6 sm:p-8 mb-6">
          {currentPlayer && (
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-amber-100 text-lg font-serif mb-1">Your identity:</p>
                <p className="text-amber-500 text-2xl font-bold font-serif">{currentPlayer.username}</p>
              </div>
              <div className="text-center">
                <p className="text-amber-500/60 text-sm uppercase tracking-wide">
                  {isHost ? "You are the host" : "Waiting for host"}
                </p>
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="text-amber-100/80 text-sm mb-4 font-serif">
              {lobby?.players.length === 4
                ? "Room is full! Host can start the game."
                : `Waiting for players... (${lobby?.players.length || 1}/4)`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lobby?.players.map((player, idx) => {
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
                      <p className="text-amber-700/60 text-xs uppercase">
                        {idx === 0 ? "Host" : player.isBot ? "Bot" : "Player"}
                      </p>
                    </div>
                  </div>
                )
              })}
              {Array.from({ length: 4 - (lobby?.players.length || 1) }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="bg-black/30 border border-amber-900/20 rounded-xl p-4 flex items-center justify-center"
                >
                  <p className="text-amber-700/40 text-sm font-serif">Waiting for player...</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
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

          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={isStarting}
              className="w-full px-8 py-4 bg-green-900/40 hover:bg-green-800/60 text-green-200 text-lg rounded-xl font-bold transition-all font-serif tracking-widest border border-green-700/50 shadow-xl disabled:opacity-50"
            >
              {isStarting ? "Starting..." : "Start Game (Bots fill empty slots)"}
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4">
            <p className="text-red-200 text-center font-serif">{error}</p>
          </div>
        )}

        <button
          onClick={handleLeave}
          className="w-full bg-red-900/40 hover:bg-red-800/60 text-red-200 py-3 rounded-xl font-bold transition-all font-serif tracking-wide border border-red-700/50"
        >
          Leave Room
        </button>
      </div>
    </div>
  )
}
