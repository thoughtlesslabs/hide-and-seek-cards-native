import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { StyleSheet } from "react-native";

export function GlowBackground({ children }: PropsWithChildren) {
  return (
    <LinearGradient
      colors={["#1c0a00", "#0c0a09", "#1c0a00"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    >
      {children}
    </LinearGradient>
  );
}
