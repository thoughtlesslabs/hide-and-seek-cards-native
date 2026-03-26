import { useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { useSettingsStore } from '../store/settingsStore';

export function useSounds() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundsRef = useRef<Record<string, Audio.Sound | null>>({
    cardFlip: null,
    elimination: null,
    victory: null,
    buttonTap: null,
  });

  useEffect(() => {
    // Set audio mode for background compatibility
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    }).catch(() => {});

    return () => {
      // Unload all sounds on unmount
      Object.values(soundsRef.current).forEach((sound) => {
        sound?.unloadAsync().catch(() => {});
      });
    };
  }, []);

  const playSound = useCallback(
    async (key: string) => {
      if (!soundEnabled) return;
      try {
        const sound = soundsRef.current[key];
        if (sound) {
          await sound.setPositionAsync(0);
          await sound.playAsync();
        }
      } catch {}
    },
    [soundEnabled]
  );

  const playCardFlip = useCallback(() => playSound('cardFlip'), [playSound]);
  const playElimination = useCallback(() => playSound('elimination'), [playSound]);
  const playVictory = useCallback(() => playSound('victory'), [playSound]);
  const playButtonTap = useCallback(() => playSound('buttonTap'), [playSound]);

  return { playCardFlip, playElimination, playVictory, playButtonTap };
}
