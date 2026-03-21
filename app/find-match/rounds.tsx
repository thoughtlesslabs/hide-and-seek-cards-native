import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { GlowBackground } from "../../components/ui/GlowBackground";
import { useGameStore } from "../../store/gameStore";
import { useSessionStore } from "../../store/sessionStore";
import * as api from "../../lib/api";

const ROUND_OPTIONS = [
  {
    rounds: 1,
    label: "Single Round",
    sub: "First to eliminate all wins",
  },
  {
    rounds: 2,
    label: "Best of 3",
    sub: "First to win 2 rounds",
  },
  {
    rounds: 3,
    label: "Best of 5",
    sub: "First to win 3 rounds",
  },
];

export default function RoundsScreen() {
  const router = useRouter();
  const playerId = useSessionStore((s) => s.playerId);
  const { selectedPlayerCount, setSelectedRoundsToWin } = useGameStore();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelect = async (rounds: number) => {
    if (loading || !playerId) return;
    setErrorMsg(null);
    setSelectedRoundsToWin(rounds);
    setLoading(true);

    try {
      await api.joinMatchmaking(playerId, rounds, selectedPlayerCount);
      router.push("/matchmaking");
    } catch (err) {
      console.error("joinMatchmaking error:", err);
      setErrorMsg("Failed to join matchmaking. Try again.");
      setLoading(false);
    }
  };

  return (
    <GlowBackground>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-cinzel-bold text-2xl text-amber-500 mb-2 tracking-wider">
          Game Length
        </Text>
        <Text className="font-cinzel text-sm text-amber-700 mb-10">
          {selectedPlayerCount}-player game
        </Text>

        {loading ? (
          <View className="items-center gap-4">
            <ActivityIndicator size="large" color="#d97706" />
            <Text className="font-cinzel text-sm text-amber-700">
              Joining matchmaking…
            </Text>
          </View>
        ) : (
          <>
            <View className="w-full max-w-xs gap-4">
              {ROUND_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.rounds}
                  className="bg-stone-800 border border-amber-700/50 py-4 px-6 rounded-xl active:bg-stone-700"
                  onPress={() => handleSelect(opt.rounds)}
                >
                  <Text className="font-cinzel-bold text-amber-500 text-lg text-center tracking-wide">
                    {opt.label}
                  </Text>
                  <Text className="font-cinzel text-xs text-amber-800 text-center mt-1">
                    {opt.sub}
                  </Text>
                </Pressable>
              ))}
            </View>

            {errorMsg && (
              <Text className="font-cinzel text-xs text-red-500 mt-4 text-center">
                {errorMsg}
              </Text>
            )}

            <Pressable
              className="mt-8 px-6 py-2 rounded-lg active:bg-stone-800"
              onPress={() => router.back()}
            >
              <Text className="font-cinzel text-stone-500">← Back</Text>
            </Pressable>
          </>
        )}
      </View>
    </GlowBackground>
  );
}
