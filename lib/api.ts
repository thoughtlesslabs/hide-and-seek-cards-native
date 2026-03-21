import type { Lobby, LobbyPlayer, SharedGameState } from "../types/multiplayer";

// Point this at your Next.js backend
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://hide-and-seek-cards.vercel.app";

async function post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

// --- Matchmaking ---

export function joinMatchmaking(
  playerId: string,
  roundsToWin = 2,
  maxPlayers = 8
): Promise<LobbyPlayer> {
  return post("/api/multiplayer/join-matchmaking", { playerId, roundsToWin, maxPlayers });
}

export function getLobbyStatus(playerId: string): Promise<Lobby | null> {
  return post("/api/multiplayer/lobby-status", { playerId });
}

export function leaveLobby(playerId: string): Promise<void> {
  return post("/api/multiplayer/leave-lobby", { playerId });
}

// --- Game State ---

export function pollGameState(
  playerId: string
): Promise<{ state: SharedGameState | null; reactions: Record<string, string> }> {
  return post("/api/multiplayer/poll-game-state", { playerId });
}

export function getGameState(playerId: string): Promise<SharedGameState | null> {
  return post("/api/multiplayer/get-game-state", { playerId });
}

export function selectTarget(
  playerId: string,
  targetId: string
): Promise<SharedGameState | null> {
  return post("/api/multiplayer/select-target", { playerId, targetId });
}

export function selectCard(
  playerId: string,
  cardId: string,
  targetId?: string
): Promise<SharedGameState | null> {
  return post("/api/multiplayer/select-card", { playerId, cardId, targetId });
}

// --- Heartbeat / Activity ---

export function sendHeartbeat(playerId: string): Promise<void> {
  return post("/api/multiplayer/heartbeat", { playerId });
}

export function sendEmojiReaction(playerId: string, emoji: string): Promise<void> {
  return post("/api/multiplayer/emoji-reaction", { playerId, emoji });
}

export function getEmojiReactions(lobbyId: string): Promise<Record<string, string>> {
  return post("/api/multiplayer/emoji-reactions", { lobbyId });
}

// --- Game Lifecycle ---

export function finishGame(playerId: string): Promise<void> {
  return post("/api/multiplayer/finish-game", { playerId });
}

export function leaveGame(playerId: string): Promise<void> {
  return post("/api/multiplayer/leave-game", { playerId });
}

export function voteForRematch(playerId: string): Promise<SharedGameState | null> {
  return post("/api/multiplayer/vote-rematch", { playerId });
}

export function startRematchVote(playerId: string): Promise<SharedGameState | null> {
  return post("/api/multiplayer/start-rematch", { playerId });
}

// --- Private Games ---

export function hostPrivateLobby(
  playerId: string,
  roundsToWin: number,
  maxPlayers: number
): Promise<{ lobby: Lobby; gameCode: string }> {
  return post("/api/multiplayer/host-private-lobby", { playerId, roundsToWin, maxPlayers });
}

export function joinByCode(
  playerId: string,
  gameCode: string
): Promise<{ success: boolean; error?: string }> {
  return post("/api/multiplayer/join-by-code", { playerId, gameCode });
}

export function hostStartGame(
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  return post("/api/multiplayer/host-start-game", { playerId });
}

// --- Stats ---

export function getGlobalStats(): Promise<{
  playersOnline: number;
  gamesInProgress: number;
}> {
  return get("/api/multiplayer/global-stats");
}

export function getLobbiesWaitingByConfig(): Promise<{
  lobbies: Array<{ maxPlayers: number; roundsToWin: number; count: number }>;
}> {
  return get("/api/multiplayer/lobby-stats");
}

// --- Turn Management ---

export function checkTurnTimeout(lobbyId: string): Promise<SharedGameState | null> {
  return post("/api/multiplayer/check-turn-timeout", { lobbyId });
}

export function checkDisconnects(lobbyId: string): Promise<string[]> {
  return post("/api/multiplayer/check-disconnects", { lobbyId });
}

export function checkBotOnlyGame(lobbyId: string): Promise<boolean> {
  return post("/api/multiplayer/check-bot-only", { lobbyId });
}
