import { create } from "zustand";
import type { Lobby } from "../types/multiplayer";
import type { SharedGameState } from "../types/multiplayer";

// ---------------------------------------------------------------------------
// Game mode — mirrors the SPA state machine from web/page.tsx
// ---------------------------------------------------------------------------
export type GameMode =
  | "menu"
  | "playerSelection"
  | "roundSelection"
  | "matchmaking"
  | "hostOrJoin"
  | "hostPlayerSelection"
  | "hostRoundSelection"
  | "joinWithCode"
  | "privateLobby"
  | "playing"
  | "offline";

// ---------------------------------------------------------------------------
// Emoji reactions — expiry-aware
// ---------------------------------------------------------------------------
export interface PlayerReaction {
  playerId: string;
  emoji: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------
interface GameStore {
  // ── navigation / game mode ─────────────────────────────────────────────
  gameMode: GameMode;

  // ── lobby / multiplayer state ──────────────────────────────────────────
  currentLobby: Lobby | null;
  sharedGameState: SharedGameState | null;

  // ── configuration choices made by the player ──────────────────────────
  selectedPlayerCount: number;
  selectedRoundsToWin: number;

  // ── UI-layer ephemeral state ───────────────────────────────────────────
  /** Emoji reactions keyed by playerId — gets pruned on every poll tick */
  playerReactions: Record<string, PlayerReaction>;
  /** Optimistic local target selection while server processes the move */
  localSelectedTarget: string | null;
  /** True if the game started while the app was in the background */
  gameStartedWhileAway: boolean;

  // ── actions ───────────────────────────────────────────────────────────
  setGameMode: (mode: GameMode) => void;
  setCurrentLobby: (lobby: Lobby | null) => void;
  setSharedGameState: (state: SharedGameState | null) => void;
  setSelectedPlayerCount: (count: number) => void;
  setSelectedRoundsToWin: (rounds: number) => void;
  setLocalSelectedTarget: (targetId: string | null) => void;
  setGameStartedWhileAway: (value: boolean) => void;

  /**
   * Add an emoji reaction. Existing reaction for the same player is overwritten.
   * Caller is responsible for pruning expired reactions via `pruneReactions`.
   */
  addReaction: (reaction: PlayerReaction) => void;

  /**
   * Remove reactions older than `maxAgeMs` (default 3 000 ms).
   * Designed to be called inside the polling hook after each tick.
   */
  pruneReactions: (maxAgeMs?: number) => void;

  /** Full reset — called when leaving a game or returning to menu */
  resetGameState: () => void;
}

// ---------------------------------------------------------------------------
// Default / empty values
// ---------------------------------------------------------------------------
const DEFAULT_PLAYER_COUNT = 8;
const DEFAULT_ROUNDS_TO_WIN = 2;

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------
export const useGameStore = create<GameStore>((set, get) => ({
  // ── initial state ───────────────────────────────────────────────────────
  gameMode: "menu",
  currentLobby: null,
  sharedGameState: null,
  selectedPlayerCount: DEFAULT_PLAYER_COUNT,
  selectedRoundsToWin: DEFAULT_ROUNDS_TO_WIN,
  playerReactions: {},
  localSelectedTarget: null,
  gameStartedWhileAway: false,

  // ── navigation ──────────────────────────────────────────────────────────
  setGameMode: (mode) => set({ gameMode: mode }),

  // ── lobby / server state ────────────────────────────────────────────────
  setCurrentLobby: (lobby) => set({ currentLobby: lobby }),

  setSharedGameState: (state) =>
    set({
      sharedGameState: state,
      // Clear the optimistic target once the server confirms the move
      localSelectedTarget:
        state?.targetPlayerId != null ? null : get().localSelectedTarget,
    }),

  // ── configuration ───────────────────────────────────────────────────────
  setSelectedPlayerCount: (count) => set({ selectedPlayerCount: count }),
  setSelectedRoundsToWin: (rounds) => set({ selectedRoundsToWin: rounds }),

  // ── local UI state ──────────────────────────────────────────────────────
  setLocalSelectedTarget: (targetId) => set({ localSelectedTarget: targetId }),
  setGameStartedWhileAway: (value) => set({ gameStartedWhileAway: value }),

  // ── reactions ───────────────────────────────────────────────────────────
  addReaction: (reaction) =>
    set((s) => ({
      playerReactions: {
        ...s.playerReactions,
        [reaction.playerId]: reaction,
      },
    })),

  pruneReactions: (maxAgeMs = 3_000) => {
    const now = Date.now();
    set((s) => {
      const pruned: Record<string, PlayerReaction> = {};
      for (const [id, r] of Object.entries(s.playerReactions)) {
        if (now - r.timestamp < maxAgeMs) pruned[id] = r;
      }
      // Only update if something actually changed
      if (Object.keys(pruned).length === Object.keys(s.playerReactions).length) return s;
      return { playerReactions: pruned };
    });
  },

  // ── full reset ──────────────────────────────────────────────────────────
  resetGameState: () =>
    set({
      gameMode: "menu",
      currentLobby: null,
      sharedGameState: null,
      playerReactions: {},
      localSelectedTarget: null,
      gameStartedWhileAway: false,
    }),
}));
