import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { StyleSheet } from "react-native";

export function GlowBackground({ children }: PropsWithChildren) {
  return (
    <LinearGradient
      colors={["#3d1a00", "#1f0d00", "#0a0500", "#000000"]}
      locations={[0, 0.35, 0.7, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    >
      {children}
    </LinearGradient>
  );
}
