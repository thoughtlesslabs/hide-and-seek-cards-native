/**
 * useGamePolling
 *
 * Polls the backend every 500 ms for the latest game state.
 * Automatically pauses when the app goes into the background (AppState),
 * and resumes (with an immediate poll) when it comes back to the foreground.
 *
 * The hook wires sessionStore.playerId in from the caller so that the
 * component tree doesn't need to pass it down explicitly.
 *
 * Usage:
 *   // In your game screen:
 *   useGamePolling({ enabled: gameMode === 'playing' });
 */

import { useCallback, useEffect, useRef } from "react";
import * as api from "../lib/api";
import { useSessionStore } from "../store/sessionStore";
import { useGameStore } from "../store/gameStore";
import { useAppStateHandler } from "./useAppStateHandler";

const POLL_INTERVAL_MS = 500;

interface UseGamePollingOptions {
  /**
   * When false the polling loop is stopped entirely.
   * Typically set to `gameMode === 'playing' || gameMode === 'matchmaking'`.
   */
  enabled: boolean;
}

export function useGamePolling({ enabled }: UseGamePollingOptions) {
  const playerId = useSessionStore((s) => s.playerId);
  const { setSharedGameState, setCurrentLobby, addReaction, pruneReactions } =
    useGameStore();

  // We use a ref for the interval handle so we can clear/recreate it without
  // triggering re-renders or stale closure problems.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enabledRef = useRef(enabled);
  const playerIdRef = useRef(playerId);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  // ── Core poll function ───────────────────────────────────────────────────
  const poll = useCallback(async () => {
    const pid = playerIdRef.current;
    if (!pid || !enabledRef.current) return;

    try {
      const result = await api.pollGameState(pid);

      if (result?.state) {
        setSharedGameState(result.state);
      }

      // Ingest emoji reactions from the poll response
      if (result?.reactions) {
        const now = Date.now();
        for (const [reactionPlayerId, emoji] of Object.entries(result.reactions)) {
          addReaction({ playerId: reactionPlayerId, emoji, timestamp: now });
        }
      }

      // Prune stale reactions on each tick
      pruneReactions();
    } catch {
      // Network errors are silent — the game continues with the last known state
    }
  }, [setSharedGameState, addReaction, pruneReactions]);

  // ── Start / stop helpers ─────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // already running
    poll(); // immediate first tick
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [poll]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Lifecycle: start/stop based on `enabled` prop ───────────────────────
  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  // ── Pause when backgrounded, resume when foregrounded ───────────────────
  useAppStateHandler({
    onForeground: () => {
      if (enabledRef.current) {
        startPolling();
      }
    },
    onBackground: () => {
      stopPolling();
    },
  });
}
