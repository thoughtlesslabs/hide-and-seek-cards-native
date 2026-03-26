import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PLAYER_ID_KEY = "hide-seek:player-id";

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `player_${id}_${Date.now()}`;
}

interface SessionStore {
  playerId: string;
  isLoaded: boolean;
  initialize: () => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  playerId: "",
  isLoaded: false,

  initialize: async () => {
    if (get().isLoaded) return;
    try {
      let id = await AsyncStorage.getItem(PLAYER_ID_KEY);
      if (!id) {
        id = generateId();
        await AsyncStorage.setItem(PLAYER_ID_KEY, id);
      }
      set({ playerId: id, isLoaded: true });
    } catch {
      const id = generateId();
      set({ playerId: id, isLoaded: true });
    }
  },
}));

// Auto-initialize on import
useSessionStore.getState().initialize();
