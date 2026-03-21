import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { GlowBackground } from "../../components/ui/GlowBackground";
import { useGameStore } from "../../store/gameStore";
import * as api from "../../lib/api";

export default function PlayersScreen() {
  const router = useRouter();
  const { setSelectedPlayerCount } = useGameStore();

  /** Aggregated waiting-lobby counts keyed by maxPlayers */
  const [lobbyCounts, setLobbyCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getLobbiesWaitingByConfig()
      .then(({ lobbies }) => {
        const counts: Record<number, number> = {};
        for (const lobby of lobbies) {
          counts[lobby.maxPlayers] =
            (counts[lobby.maxPlayers] ?? 0) + lobby.count;
        }
        setLobbyCounts(counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (count: number) => {
    setSelectedPlayerCount(count);
    router.push("/find-match/rounds");
  };

  return (
    <GlowBackground>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-cinzel-bold text-2xl text-amber-500 mb-2 tracking-wider">
          How Many Players?
        </Text>
        <Text className="font-cinzel text-xs text-amber-800 mb-10">
          Choose lobby size
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#d97706" />
        ) : (
          <View className="flex-row gap-6">
            {([4, 8] as const).map((count) => {
              const waiting = lobbyCounts[count] ?? 0;
              return (
                <Pressable
                  key={count}
                  className="bg-stone-800 border border-amber-700/50 w-32 h-36 rounded-2xl
                    items-center justify-center active:bg-stone-700"
                  onPress={() => handleSelect(count)}
                >
                  <Text className="font-cinzel-bold text-4xl text-amber-500">
                    {count}
                  </Text>
                  <Text className="font-cinzel text-sm text-amber-700 mt-1">
                    Players
                  </Text>
                  {waiting > 0 ? (
                    <View className="mt-3 bg-green-900/60 rounded-full px-3 py-0.5 border border-green-700/40">
                      <Text className="font-cinzel text-xs text-green-400">
                        {waiting} waiting
                      </Text>
                    </View>
                  ) : (
                    <View className="mt-3 bg-stone-900/60 rounded-full px-3 py-0.5">
                      <Text className="font-cinzel text-xs text-stone-500">
                        empty
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          className="mt-10 px-6 py-2 rounded-lg active:bg-stone-800"
          onPress={() => router.back()}
        >
          <Text className="font-cinzel text-stone-500">← Back</Text>
        </Pressable>
      </View>
    </GlowBackground>
  );
}
