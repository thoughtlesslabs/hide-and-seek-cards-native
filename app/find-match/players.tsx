import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { GlowBackground } from "../../components/ui/GlowBackground";

export default function PlayersScreen() {
  const router = useRouter();

  return (
    <GlowBackground>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-cinzel-bold text-2xl text-amber-500 mb-8">
          How Many Players?
        </Text>
        <View className="flex-row gap-6">
          {[4, 8].map((count) => (
            <Pressable
              key={count}
              className="bg-stone-800 border border-amber-700/50 w-28 h-28 rounded-2xl items-center justify-center active:bg-stone-700"
              onPress={() =>
                router.push({
                  pathname: "/find-match/rounds",
                  params: { players: String(count) },
                })
              }
            >
              <Text className="font-cinzel-bold text-3xl text-amber-500">{count}</Text>
              <Text className="font-cinzel text-xs text-amber-700 mt-1">Players</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </GlowBackground>
  );
}
