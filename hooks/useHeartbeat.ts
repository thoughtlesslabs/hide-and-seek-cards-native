/**
 * useHeartbeat
 *
 * Sends a heartbeat to the backend every 5 seconds so the server knows
 * the player is still connected (used for disconnect detection / bot replacement).
 *
 * Automatically pauses when the app goes to the background (no point sending
 * heartbeats when the user isn't looking), and resumes on foreground.
 *
 * Wires `sessionStore.playerId` internally.
 *
 * Usage:
 *   useHeartbeat({ enabled: gameMode === 'playing' || gameMode === 'matchmaking' });
 */

import { useCallback, useEffect, useRef } from "react";
import * as api from "../lib/api";
import { useSessionStore } from "../store/sessionStore";
import { useAppStateHandler } from "./useAppStateHandler";

const HEARTBEAT_INTERVAL_MS = 5_000;

interface UseHeartbeatOptions {
  /**
   * Only send heartbeats while this is true.
   * Typically tied to being inside an active game or matchmaking lobby.
   */
  enabled: boolean;
}

export function useHeartbeat({ enabled }: UseHeartbeatOptions) {
  const playerId = useSessionStore((s) => s.playerId);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enabledRef = useRef(enabled);
  const playerIdRef = useRef(playerId);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  // ── Core heartbeat function ──────────────────────────────────────────────
  const beat = useCallback(async () => {
    const pid = playerIdRef.current;
    if (!pid || !enabledRef.current) return;

    try {
      await api.sendHeartbeat(pid);
    } catch {
      // Silently swallow failures — a missed heartbeat is not fatal for the
      // player, the server will eventually mark them as disconnected if they
      // miss several in a row.
    }
  }, []);

  // ── Start / stop helpers ─────────────────────────────────────────────────
  const startHeartbeat = useCallback(() => {
    if (intervalRef.current) return;
    beat(); // send immediately on start
    intervalRef.current = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  }, [beat]);

  const stopHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (enabled) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }

    return () => {
      stopHeartbeat();
    };
  }, [enabled, startHeartbeat, stopHeartbeat]);

  // ── Pause on background, resume on foreground ────────────────────────────
  useAppStateHandler({
    onForeground: () => {
      if (enabledRef.current) startHeartbeat();
    },
    onBackground: () => {
      stopHeartbeat();
    },
  });
}
