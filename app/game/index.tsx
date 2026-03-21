import { View, Text } from "react-native";
import { GlowBackground } from "../../components/ui/GlowBackground";

export default function GameScreen() {
  return (
    <GlowBackground>
      <View className="flex-1 items-center justify-center">
        <Text className="font-cinzel-bold text-xl text-amber-500">
          Game Board
        </Text>
        <Text className="font-cinzel text-sm text-amber-700 mt-2">
          Coming in Sprint 3
        </Text>
      </View>
    </GlowBackground>
  );
}
