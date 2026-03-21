/**
 * useGameStartCountdown
 *
 * Counts down the 3-second "game starting!" countdown displayed in the
 * matchmaking / lobby screen before the game begins.
 *
 * Derives its countdown from `currentLobby.startTimer` (a Unix timestamp in
 * milliseconds set by the server when the lobby fills up) or falls back to
 * `sharedGameState.gameStartTime`.
 *
 * Returns:
 *   - `gameStartCountdown` — whole seconds remaining (3 → 2 → 1 → 0), or null
 *     when no countdown is active.
 *   - `isCountingDown`     — convenience boolean; true while countdown > 0.
 *
 * Usage:
 *   const { gameStartCountdown, isCountingDown } = useGameStartCountdown();
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";

const COUNTDOWN_DURATION_MS = 3_000; // 3 seconds
const TICK_INTERVAL_MS = 100;

interface GameStartCountdownResult {
  /** Seconds remaining in the pre-game countdown, or null when inactive. */
  gameStartCountdown: number | null;
  /** True while the countdown is ticking (gameStartCountdown > 0). */
  isCountingDown: boolean;
}

export function useGameStartCountdown(): GameStartCountdownResult {
  const currentLobby = useGameStore((s) => s.currentLobby);
  const sharedGameState = useGameStore((s) => s.sharedGameState);

  // Prefer the lobby's startTimer; fall back to sharedGameState.gameStartTime
  const gameStartTime: number | null =
    currentLobby?.startTimer ?? sharedGameState?.gameStartTime ?? null;

  const [gameStartCountdown, setGameStartCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (gameStartTime === null) {
      setGameStartCountdown(null);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const remainingMs = gameStartTime - now;

      if (remainingMs <= 0) {
        // Countdown has expired — display 0 briefly so the UI can show "GO!"
        setGameStartCountdown(0);
      } else {
        const remainingSecs = Math.min(
          Math.ceil(remainingMs / 1_000),
          Math.ceil(COUNTDOWN_DURATION_MS / 1_000)
        );
        setGameStartCountdown(remainingSecs);
      }
    };

    tick();
    const id = setInterval(tick, TICK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [gameStartTime]);

  return {
    gameStartCountdown,
    isCountingDown: gameStartCountdown !== null && gameStartCountdown > 0,
  };
}
