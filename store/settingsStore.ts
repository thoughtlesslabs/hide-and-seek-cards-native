import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'hide-seek:settings';

interface SettingsStore {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  isLoaded: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticEnabled: (enabled: boolean) => void;
  initialize: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  soundEnabled: true,
  hapticEnabled: true,
  isLoaded: false,

  setSoundEnabled: (enabled: boolean) => {
    set({ soundEnabled: enabled });
    persistSettings(get());
  },

  setHapticEnabled: (enabled: boolean) => {
    set({ hapticEnabled: enabled });
    persistSettings(get());
  },

  initialize: async () => {
    if (get().isLoaded) return;
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          soundEnabled: parsed.soundEnabled ?? true,
          hapticEnabled: parsed.hapticEnabled ?? true,
          isLoaded: true,
        });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },
}));

function persistSettings(state: SettingsStore) {
  AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      soundEnabled: state.soundEnabled,
      hapticEnabled: state.hapticEnabled,
    })
  ).catch(() => {});
}

// Auto-initialize on import
useSettingsStore.getState().initialize();
