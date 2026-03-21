/**
 * useAppStateHandler
 *
 * Monitors React Native's AppState (foreground / background / inactive) and
 * exposes helpers for components that need to react to visibility changes.
 *
 * This replaces the web app's `document.visibilityState` / Page Visibility API.
 *
 * Usage:
 *   const { isActive } = useAppStateHandler({
 *     onForeground: () => { /* resumed *\/ },
 *     onBackground: () => { /* paused  *\/ },
 *   });
 */

import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

export interface AppStateHandlerOptions {
  /** Called every time the app transitions FROM background/inactive → active. */
  onForeground?: () => void;
  /** Called every time the app transitions FROM active → background/inactive. */
  onBackground?: () => void;
}

export interface AppStateHandlerResult {
  /** True when the app is currently in the foreground (appState === 'active'). */
  isActive: boolean;
  /** The raw AppState status string. */
  appState: AppStateStatus;
}

export function useAppStateHandler(
  options: AppStateHandlerOptions = {}
): AppStateHandlerResult {
  const { onForeground, onBackground } = options;

  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );

  // Keep the callbacks in a ref so they don't cause the effect to re-run on
  // every render if the caller defines them inline.
  const onForegroundRef = useRef(onForeground);
  const onBackgroundRef = useRef(onBackground);
  useEffect(() => {
    onForegroundRef.current = onForeground;
  }, [onForeground]);
  useEffect(() => {
    onBackgroundRef.current = onBackground;
  }, [onBackground]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const prevState = appState;

        setAppState(nextState);

        const wasActive = prevState === "active";
        const isNowActive = nextState === "active";

        if (!wasActive && isNowActive) {
          onForegroundRef.current?.();
        } else if (wasActive && !isNowActive) {
          onBackgroundRef.current?.();
        }
      }
    );

    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — we only register once

  return {
    isActive: appState === "active",
    appState,
  };
}
