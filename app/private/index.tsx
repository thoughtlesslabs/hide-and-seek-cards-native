import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { GlowBackground } from "../../components/ui/GlowBackground";

export default function PrivateScreen() {
  const router = useRouter();

  return (
    <GlowBackground>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-cinzel-bold text-2xl text-amber-500 mb-8">
          Private Game
        </Text>
        <View className="w-full max-w-xs gap-4">
          <Pressable
            className="bg-amber-700 py-4 rounded-xl items-center active:bg-amber-800"
            onPress={() => {
              // TODO: host flow
            }}
          >
            <Text className="font-cinzel-bold text-white text-lg">Host Game</Text>
          </Pressable>
          <Pressable
            className="bg-stone-800 border border-amber-700/50 py-4 rounded-xl items-center active:bg-stone-700"
            onPress={() => {
              // TODO: join flow
            }}
          >
            <Text className="font-cinzel-bold text-amber-500 text-lg">Join Game</Text>
          </Pressable>
        </View>
      </View>
    </GlowBackground>
  );
}
