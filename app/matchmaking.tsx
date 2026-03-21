import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { GlowBackground } from "../components/ui/GlowBackground";
import { useSessionStore } from "../store/sessionStore";
import * as api from "../lib/api";

export default function MatchmakingScreen() {
  const router = useRouter();
  const { players, roundsToWin } = useLocalSearchParams<{
    players: string;
    roundsToWin: string;
  }>();
  const playerId = useSessionStore((s) => s.playerId);

  useEffect(() => {
    if (!playerId) return;
    api
      .joinMatchmaking(playerId, Number(roundsToWin) || 2, Number(players) || 8)
      .catch(console.error);
  }, [playerId]);

  return (
    <GlowBackground>
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator size="large" color="#d97706" />
        <Text className="font-cinzel-bold text-xl text-amber-500 mt-6 mb-2">
          Finding Players…
        </Text>
        <Text className="font-cinzel text-sm text-amber-700">
          {players} players · Best of {Number(roundsToWin) * 2 - 1}
        </Text>

        <Pressable
          className="mt-12 px-8 py-3 border border-stone-600 rounded-xl active:bg-stone-800"
          onPress={() => {
            if (playerId) api.leaveLobby(playerId).catch(console.error);
            router.back();
          }}
        >
          <Text className="font-cinzel text-stone-400">Cancel</Text>
        </Pressable>
      </View>
    </GlowBackground>
  );
}
