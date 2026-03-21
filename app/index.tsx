import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { useRouter } from "expo-router";
import { GlowBackground } from "../components/ui/GlowBackground";
import * as api from "../lib/api";

interface GlobalStats {
  playersOnline: number;
  gamesInProgress: number;
}

export default function MenuScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<GlobalStats | null>(null);

  // ── Animated card preview ──────────────────────────────────────────────
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -14,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: -1,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim, rotateAnim]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-6deg", "6deg"],
  });

  // ── Live stats badge ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchStats = () => {
      api.getGlobalStats().then(setStats).catch(() => {});
    };
    fetchStats();
    const id = setInterval(fetchStats, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <GlowBackground>
      <View className="flex-1 items-center justify-center px-6">
        {/* Live stats badge */}
        {stats && (
          <View
            className="absolute top-14 right-5 flex-row items-center gap-1.5
              bg-stone-900/80 border border-amber-900/40 rounded-full px-3 py-1.5"
          >
            <View className="w-2 h-2 rounded-full bg-green-500" />
            <Text className="font-cinzel text-xs text-amber-600">
              {stats.playersOnline} online
            </Text>
          </View>
        )}

        {/* Animated card preview */}
        <Animated.View
          style={{
            transform: [
              { translateY: floatAnim },
              { rotate: rotateInterpolate },
            ],
            marginBottom: 32,
          }}
        >
          <View
            style={{
              width: 80,
              height: 112,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: "#d97706",
              backgroundColor: "#92400e",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#d97706",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <Text style={{ fontSize: 40 }}>🃏</Text>
          </View>
        </Animated.View>

        {/* Title */}
        <Text className="font-cinzel-bold text-5xl text-amber-500 mb-1 text-center tracking-widest">
          Hide & Seek
        </Text>
        <Text className="font-cinzel text-xl text-amber-700 mb-12 text-center tracking-[0.3em]">
          CARDS
        </Text>

        {/* Nav buttons */}
        <View className="w-full max-w-xs gap-4">
          <Pressable
            className="bg-amber-700 py-4 rounded-xl items-center active:bg-amber-800"
            onPress={() => router.push("/find-match/players")}
          >
            <Text className="font-cinzel-bold text-white text-lg tracking-wider">
              Find Match
            </Text>
          </Pressable>

          <Pressable
            className="bg-stone-800 border border-amber-700/50 py-4 rounded-xl items-center active:bg-stone-700"
            onPress={() => router.push("/private")}
          >
            <Text className="font-cinzel-bold text-amber-500 text-lg tracking-wider">
              Private Game
            </Text>
          </Pressable>

          <Pressable
            className="bg-stone-900 border border-stone-700 py-4 rounded-xl items-center active:bg-stone-800"
            onPress={() => router.push("/offline/game")}
          >
            <Text className="font-cinzel-bold text-stone-400 text-lg tracking-wider">
              Play Offline
            </Text>
          </Pressable>
        </View>

        {/* Games in progress count */}
        {stats && stats.gamesInProgress > 0 && (
          <Text className="font-cinzel text-xs text-stone-600 mt-8">
            {stats.gamesInProgress} game{stats.gamesInProgress !== 1 ? "s" : ""} in progress
          </Text>
        )}
      </View>
    </GlowBackground>
  );
}
