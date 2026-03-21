import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { GlowBackground } from "../../components/ui/GlowBackground";
import { useGameStore } from "../../store/gameStore";
import { useSessionStore } from "../../store/sessionStore";
import * as api from "../../lib/api";

// ── Sub-screen types ────────────────────────────────────────────────────────
type View_ = "choose" | "hosting" | "joining";

const PLAYER_OPTIONS = [4, 8] as const;
const ROUND_OPTIONS = [
  { rounds: 1, label: "Single Round" },
  { rounds: 2, label: "Best of 3" },
  { rounds: 3, label: "Best of 5" },
] as const;

export default function PrivateScreen() {
  const router = useRouter();
  const playerId = useSessionStore((s) => s.playerId);
  const { setCurrentLobby } = useGameStore();

  const [screen, setScreen] = useState<View_>("choose");

  // Host state
  const [hostPlayers, setHostPlayers] = useState<number>(8);
  const [hostRounds, setHostRounds] = useState<number>(2);
  const [hosting, setHosting] = useState(false);
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);

  // Join state
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // ── Host flow ───────────────────────────────────────────────────────────

  const handleHost = async () => {
    if (!playerId || hosting) return;
    setHostError(null);
    setHosting(true);
    try {
      const { lobby, gameCode: code } = await api.hostPrivateLobby(
        playerId,
        hostRounds,
        hostPlayers
      );
      setCurrentLobby(lobby);
      setGameCode(code);
    } catch (err) {
      console.error("hostPrivateLobby error:", err);
      setHostError("Failed to create lobby. Please try again.");
    } finally {
      setHosting(false);
    }
  };

  const handleStartGame = async () => {
    if (!playerId) return;
    try {
      await api.hostStartGame(playerId);
      router.replace("/matchmaking");
    } catch (err) {
      console.error("hostStartGame error:", err);
      setHostError("Could not start the game. Try again.");
    }
  };

  // ── Join flow ───────────────────────────────────────────────────────────

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setJoinError("Enter a 4-letter code.");
      return;
    }
    if (!playerId || joining) return;
    setJoinError(null);
    setJoining(true);
    try {
      const result = await api.joinByCode(playerId, code);
      if (result.success) {
        router.replace("/matchmaking");
      } else {
        setJoinError(result.error ?? "Invalid code. Check with your host.");
      }
    } catch (err) {
      console.error("joinByCode error:", err);
      setJoinError("Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <GlowBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Choose screen ── */}
          {screen === "choose" && (
            <View className="flex-1 items-center justify-center px-6 py-16">
              <Text className="font-cinzel-bold text-2xl text-amber-500 mb-2 tracking-wider">
                Private Game
              </Text>
              <Text className="font-cinzel text-xs text-amber-800 mb-12">
                Play with friends
              </Text>

              <View className="w-full max-w-xs gap-5">
                <Pressable
                  className="bg-amber-700 py-5 rounded-xl items-center active:bg-amber-800"
                  onPress={() => setScreen("hosting")}
                >
                  <Text className="font-cinzel-bold text-white text-lg tracking-wider">
                    Host Game
                  </Text>
                  <Text className="font-cinzel text-xs text-amber-200 mt-1">
                    Create a lobby & share the code
                  </Text>
                </Pressable>

                <Pressable
                  className="bg-stone-800 border border-amber-700/50 py-5 rounded-xl items-center active:bg-stone-700"
                  onPress={() => setScreen("joining")}
                >
                  <Text className="font-cinzel-bold text-amber-500 text-lg tracking-wider">
                    Join Game
                  </Text>
                  <Text className="font-cinzel text-xs text-amber-800 mt-1">
                    Enter a 4-letter code
                  </Text>
                </Pressable>
              </View>

              <Pressable
                className="mt-10 px-6 py-2 rounded-lg active:bg-stone-800"
                onPress={() => router.back()}
              >
                <Text className="font-cinzel text-stone-500">← Back</Text>
              </Pressable>
            </View>
          )}

          {/* ── Host screen ── */}
          {screen === "hosting" && (
            <View className="flex-1 items-center justify-center px-6 py-16">
              <Text className="font-cinzel-bold text-2xl text-amber-500 mb-8 tracking-wider">
                Host a Game
              </Text>

              {gameCode ? (
                /* Lobby created — show code and wait */
                <View className="w-full max-w-xs items-center gap-6">
                  <Text className="font-cinzel text-sm text-amber-700">
                    Share this code with friends:
                  </Text>
                  <View className="bg-stone-900 border-2 border-amber-600 rounded-2xl px-10 py-6 items-center">
                    <Text
                      style={{ fontFamily: "Cinzel_700Bold", fontSize: 40, color: "#fbbf24", letterSpacing: 10 }}
                    >
                      {gameCode}
                    </Text>
                  </View>
                  <Text className="font-cinzel text-xs text-stone-500 text-center">
                    {hostPlayers} players · {ROUND_OPTIONS.find(r => r.rounds === hostRounds)?.label}
                  </Text>

                  <Pressable
                    className="bg-amber-700 w-full py-4 rounded-xl items-center active:bg-amber-800 mt-2"
                    onPress={handleStartGame}
                  >
                    <Text className="font-cinzel-bold text-white text-lg tracking-wider">
                      Start Game
                    </Text>
                  </Pressable>

                  {hostError && (
                    <Text className="font-cinzel text-xs text-red-500 text-center">
                      {hostError}
                    </Text>
                  )}

                  <Pressable
                    className="px-6 py-2 rounded-lg active:bg-stone-800"
                    onPress={() => { setGameCode(null); setScreen("choose"); }}
                  >
                    <Text className="font-cinzel text-stone-500">← Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                /* Config pickers */
                <View className="w-full max-w-xs gap-6">
                  {/* Player count */}
                  <View>
                    <Text className="font-cinzel text-xs text-amber-800 mb-3 tracking-widest uppercase">
                      Players
                    </Text>
                    <View className="flex-row gap-3">
                      {PLAYER_OPTIONS.map((n) => (
                        <Pressable
                          key={n}
                          className={`flex-1 py-4 rounded-xl items-center border
                            ${hostPlayers === n
                              ? "bg-amber-700 border-amber-600"
                              : "bg-stone-800 border-stone-700 active:bg-stone-700"
                            }`}
                          onPress={() => setHostPlayers(n)}
                        >
                          <Text className={`font-cinzel-bold text-xl
                            ${hostPlayers === n ? "text-white" : "text-amber-600"}`}>
                            {n}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Rounds */}
                  <View>
                    <Text className="font-cinzel text-xs text-amber-800 mb-3 tracking-widest uppercase">
                      Game Length
                    </Text>
                    <View className="gap-2">
                      {ROUND_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.rounds}
                          className={`py-3 px-4 rounded-xl border
                            ${hostRounds === opt.rounds
                              ? "bg-amber-700/30 border-amber-600"
                              : "bg-stone-800 border-stone-700 active:bg-stone-700"
                            }`}
                          onPress={() => setHostRounds(opt.rounds)}
                        >
                          <Text className={`font-cinzel text-sm text-center
                            ${hostRounds === opt.rounds ? "text-amber-400" : "text-stone-400"}`}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {hostError && (
                    <Text className="font-cinzel text-xs text-red-500 text-center">
                      {hostError}
                    </Text>
                  )}

                  <Pressable
                    className={`py-4 rounded-xl items-center
                      ${hosting ? "bg-amber-800/50" : "bg-amber-700 active:bg-amber-800"}`}
                    onPress={handleHost}
                    disabled={hosting}
                  >
                    {hosting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="font-cinzel-bold text-white text-lg tracking-wider">
                        Create Lobby
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    className="px-6 py-2 rounded-lg items-center active:bg-stone-800"
                    onPress={() => setScreen("choose")}
                  >
                    <Text className="font-cinzel text-stone-500">← Back</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* ── Join screen ── */}
          {screen === "joining" && (
            <View className="flex-1 items-center justify-center px-6 py-16">
              <Text className="font-cinzel-bold text-2xl text-amber-500 mb-2 tracking-wider">
                Join Game
              </Text>
              <Text className="font-cinzel text-xs text-amber-800 mb-10">
                Enter the 4-letter code from your host
              </Text>

              <View className="w-full max-w-xs gap-5">
                {/* Code input */}
                <TextInput
                  value={joinCode}
                  onChangeText={(t) => {
                    setJoinCode(t.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4));
                    setJoinError(null);
                  }}
                  placeholder="ABCD"
                  placeholderTextColor="#57534e"
                  maxLength={4}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={{
                    fontFamily: "Cinzel_700Bold",
                    fontSize: 36,
                    color: "#fbbf24",
                    letterSpacing: 12,
                    textAlign: "center",
                    backgroundColor: "#1c1917",
                    borderWidth: 2,
                    borderColor: joinCode.length === 4 ? "#d97706" : "#44403c",
                    borderRadius: 16,
                    paddingVertical: 16,
                    paddingHorizontal: 12,
                  }}
                />

                {joinError && (
                  <Text className="font-cinzel text-xs text-red-500 text-center">
                    {joinError}
                  </Text>
                )}

                <Pressable
                  className={`py-4 rounded-xl items-center
                    ${joining || joinCode.length !== 4
                      ? "bg-amber-800/40"
                      : "bg-amber-700 active:bg-amber-800"
                    }`}
                  onPress={handleJoin}
                  disabled={joining || joinCode.length !== 4}
                >
                  {joining ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="font-cinzel-bold text-white text-lg tracking-wider">
                      Join
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  className="px-6 py-2 rounded-lg items-center active:bg-stone-800"
                  onPress={() => { setJoinCode(""); setJoinError(null); setScreen("choose"); }}
                >
                  <Text className="font-cinzel text-stone-500">← Back</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </GlowBackground>
  );
}
