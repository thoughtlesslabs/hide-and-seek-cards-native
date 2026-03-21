import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { GlowBackground } from "../components/ui/GlowBackground";
import { useGameStore } from "../store/gameStore";
import { useSessionStore } from "../store/sessionStore";
import { useGamePolling } from "../hooks/useGamePolling";
import { useGameStartCountdown } from "../hooks/useGameStartCountdown";
import EmojiPicker from "../components/game/EmojiPicker";
import * as api from "../lib/api";

function dicebearUrl(seed: string) {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}

export default function MatchmakingScreen() {
  const router = useRouter();
  const playerId = useSessionStore((s) => s.playerId);
  const {
    currentLobby,
    sharedGameState,
    selectedPlayerCount,
    selectedRoundsToWin,
    playerReactions,
    addReaction,
    setCurrentLobby,
  } = useGameStore();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const navigatedRef = useRef(false);

  // ── Poll game / lobby state ──────────────────────────────────────────
  useGamePolling({ enabled: true });

  // ── Pre-game countdown ───────────────────────────────────────────────
  const { gameStartCountdown, isCountingDown } = useGameStartCountdown();

  // Countdown pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isCountingDown) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    ).start();
    return () => pulseAnim.stopAnimation();
  }, [isCountingDown, pulseAnim]);

  // ── Poll lobby status to show joining players ────────────────────────
  useEffect(() => {
    if (!playerId) return;

    const fetchLobby = () => {
      api
        .getLobbyStatus(playerId)
        .then((lobby) => {
          if (lobby) setCurrentLobby(lobby);
        })
        .catch(() => {});
    };

    fetchLobby(); // immediate
    const id = setInterval(fetchLobby, 2_000);
    return () => clearInterval(id);
  }, [playerId, setCurrentLobby]);

  // ── Navigate to game when it starts ─────────────────────────────────
  useEffect(() => {
    if (navigatedRef.current) return;
    const phase = sharedGameState?.phase;
    if (phase && phase !== "waiting") {
      navigatedRef.current = true;
      router.replace("/game");
    }
  }, [sharedGameState?.phase, router]);

  useEffect(() => {
    if (navigatedRef.current) return;
    if (gameStartCountdown === 0 && currentLobby?.status === "starting") {
      navigatedRef.current = true;
      const t = setTimeout(() => router.replace("/game"), 700);
      return () => clearTimeout(t);
    }
  }, [gameStartCountdown, currentLobby?.status, router]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (playerId) {
      try {
        await api.leaveLobby(playerId);
      } catch {}
    }
    setCurrentLobby(null);
    router.back();
  };

  const handleEmojiSelect = async (emoji: string) => {
    setShowEmojiPicker(false);
    if (!playerId) return;
    addReaction({ playerId, emoji, timestamp: Date.now() });
    try {
      await api.sendEmojiReaction(playerId, emoji);
    } catch {}
  };

  const players = currentLobby?.players ?? [];
  const maxPlayers = currentLobby?.maxPlayers ?? selectedPlayerCount ?? 8;
  const roundsLabel =
    selectedRoundsToWin === 1
      ? "Single Round"
      : `Best of ${selectedRoundsToWin * 2 - 1}`;

  return (
    <GlowBackground>
      <View className="flex-1 px-6 pt-16 pb-8">
        {/* ── Header ── */}
        <View className="items-center mb-8">
          {isCountingDown ? (
            <View className="items-center">
              <Animated.Text
                style={{
                  transform: [{ scale: pulseAnim }],
                  fontFamily: "Cinzel_700Bold",
                  fontSize: 72,
                  color: "#FFBF00",
                  lineHeight: 80,
                }}
              >
                {gameStartCountdown}
              </Animated.Text>
              <Text className="font-cinzel text-lg text-amber-600 mt-2 tracking-widest">
                GAME STARTING
              </Text>
            </View>
          ) : gameStartCountdown === 0 ? (
            <Text className="font-cinzel-bold text-3xl text-amber-500 tracking-widest">
              GO!
            </Text>
          ) : (
            <>
              <Text className="font-cinzel-bold text-2xl text-amber-500 tracking-wider">
                Finding Players
              </Text>
              <Text className="font-cinzel text-sm text-amber-800 mt-1">
                {players.length} / {maxPlayers} · {roundsLabel}
              </Text>
              {/* Waiting dots */}
              <View className="flex-row gap-1.5 mt-3">
                {[0, 1, 2].map((i) => (
                  <WaitingDot key={i} delay={i * 300} />
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── Player grid ── */}
        <ScrollView contentContainerStyle={{ alignItems: "center" }}>
          <View className="flex-row flex-wrap justify-center gap-4 pb-4">
            {Array.from({ length: maxPlayers }).map((_, i) => {
              const player = players[i];
              const reaction = player ? playerReactions[player.id] : null;
              const avatarUri = player
                ? dicebearUrl(player.id || player.username || String(i))
                : null;

              return (
                <View key={i} className="items-center" style={{ width: 70 }}>
                  <View
                    className={`w-16 h-16 rounded-full border-2 overflow-hidden
                      items-center justify-center
                      ${player ? "border-amber-600 bg-stone-800" : "border-stone-700 bg-stone-900"}`}
                    style={{ position: "relative" }}
                  >
                    {avatarUri ? (
                      <Image
                        source={{ uri: avatarUri }}
                        style={{ width: 64, height: 64 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text
                        style={{ color: "#57534e", fontSize: 22 }}
                      >
                        ?
                      </Text>
                    )}
                    {reaction && (
                      <Text
                        style={{
                          position: "absolute",
                          top: -8,
                          right: -8,
                          fontSize: 18,
                          zIndex: 5,
                        }}
                      >
                        {reaction.emoji}
                      </Text>
                    )}
                  </View>
                  <Text
                    className="font-cinzel text-xs text-stone-500 mt-1 text-center"
                    numberOfLines={1}
                    style={{ maxWidth: 68 }}
                  >
                    {player ? player.username : "·  ·  ·"}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* ── Emoji reaction button ── */}
        <View className="flex-row justify-center mt-4 mb-3">
          <Pressable
            className="bg-stone-800 border border-amber-900/40 rounded-full px-5 py-2 active:bg-stone-700"
            onPress={() => setShowEmojiPicker(true)}
          >
            <Text style={{ fontSize: 16, color: "#d6d3d1" }}>
              😊  React
            </Text>
          </Pressable>
        </View>

        {/* ── Cancel ── */}
        <Pressable
          className="py-3 border border-stone-700 rounded-xl items-center active:bg-stone-900"
          onPress={handleCancel}
        >
          <Text className="font-cinzel text-stone-500">Cancel</Text>
        </Pressable>
      </View>

      {/* ── Emoji picker overlay ── */}
      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={handleEmojiSelect}
        onDismiss={() => setShowEmojiPicker(false)}
      />
    </GlowBackground>
  );
}

// Animated waiting dot
function WaitingDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: -8,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: anim }],
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#92400e",
      }}
    />
  );
}
