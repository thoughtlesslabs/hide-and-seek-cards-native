/**
 * useTurnTimer
 *
 * Counts down the remaining seconds for the current player's turn, deriving
 * the elapsed time from `sharedGameState.turnStartTime` (a Unix timestamp
 * in milliseconds set by the server when the turn began).
 *
 * Returns:
 *   - `turnTimeRemaining` — seconds left (0 when expired, null when no active turn)
 *   - `turnProgress`     — 0→1 fraction of turn elapsed (useful for progress bars)
 *
 * Usage:
 *   const { turnTimeRemaining } = useTurnTimer();
 *   // Renders a countdown like: {turnTimeRemaining ?? '--'}s
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";

// Must match the server-side turn timeout
const TURN_TIMEOUT_MS = 8_000; // 8 seconds
const TICK_INTERVAL_MS = 100; // update every 100 ms for smooth visuals

interface TurnTimerResult {
  /** Seconds remaining (integer, 0-clamped). Null when there is no active turn. */
  turnTimeRemaining: number | null;
  /**
   * Progress fraction from 0 (just started) → 1 (expired).
   * Null when there is no active turn.
   */
  turnProgress: number | null;
}

export function useTurnTimer(): TurnTimerResult {
  const sharedGameState = useGameStore((s) => s.sharedGameState);
  const turnStartTime = sharedGameState?.turnStartTime ?? null;
  const phase = sharedGameState?.phase ?? null;

  // Only count down during actionable phases
  const isActiveTurn =
    phase === "select_target" || phase === "select_card";

  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number | null>(null);
  const [turnProgress, setTurnProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!isActiveTurn || turnStartTime === null) {
      setTurnTimeRemaining(null);
      setTurnProgress(null);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const elapsed = now - turnStartTime;
      const remainingMs = TURN_TIMEOUT_MS - elapsed;
      const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1_000));
      const progress = Math.min(1, elapsed / TURN_TIMEOUT_MS);

      setTurnTimeRemaining(remainingSecs);
      setTurnProgress(progress);
    };

    tick(); // run immediately to avoid 100 ms flicker on mount
    const id = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isActiveTurn, turnStartTime]);

  return { turnTimeRemaining, turnProgress };
}
