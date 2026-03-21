import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { GlowBackground } from "../components/ui/GlowBackground";

export default function MenuScreen() {
  const router = useRouter();

  return (
    <GlowBackground>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-cinzel-bold text-4xl text-amber-500 mb-2 text-center">
          Hide & Seek
        </Text>
        <Text className="font-cinzel text-lg text-amber-700 mb-12 text-center">
          Cards
        </Text>

        <View className="w-full max-w-xs gap-4">
          <Pressable
            className="bg-amber-700 py-4 rounded-xl items-center active:bg-amber-800"
            onPress={() => router.push("/find-match/players")}
          >
            <Text className="font-cinzel-bold text-white text-lg">Find Match</Text>
          </Pressable>

          <Pressable
            className="bg-stone-800 border border-amber-700/50 py-4 rounded-xl items-center active:bg-stone-700"
            onPress={() => router.push("/private")}
          >
            <Text className="font-cinzel-bold text-amber-500 text-lg">Private Game</Text>
          </Pressable>

          <Pressable
            className="bg-stone-900 border border-stone-700 py-4 rounded-xl items-center active:bg-stone-800"
            onPress={() => router.push("/offline/game")}
          >
            <Text className="font-cinzel-bold text-stone-400 text-lg">Play Offline</Text>
          </Pressable>
        </View>
      </View>
    </GlowBackground>
  );
}
