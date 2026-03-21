import { View, Text, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { GlowBackground } from "../../components/ui/GlowBackground";

const ROUND_OPTIONS = [
  { label: "Single Round", rounds: 1 },
  { label: "Best of 3", rounds: 2 },
  { label: "Best of 5", rounds: 3 },
];

export default function RoundsScreen() {
  const router = useRouter();
  const { players } = useLocalSearchParams<{ players: string }>();

  return (
    <GlowBackground>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-cinzel-bold text-2xl text-amber-500 mb-8">
          Game Length
        </Text>
        <View className="w-full max-w-xs gap-4">
          {ROUND_OPTIONS.map((opt) => (
            <Pressable
              key={opt.rounds}
              className="bg-stone-800 border border-amber-700/50 py-4 rounded-xl items-center active:bg-stone-700"
              onPress={() =>
                router.push({
                  pathname: "/matchmaking",
                  params: { players, roundsToWin: String(opt.rounds) },
                })
              }
            >
              <Text className="font-cinzel-bold text-amber-500 text-lg">
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </GlowBackground>
  );
}
