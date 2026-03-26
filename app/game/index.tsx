import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { GlowBackground } from "../../components/ui/GlowBackground";
import { GameTable } from "../../components/game/GameTable";
import { TurnTimer } from "../../components/game/TurnTimer";
import EmojiPicker from "../../components/game/EmojiPicker";
import RoundEndScreen from "../../components/screens/RoundEndScreen";
import SeriesEndScreen from "../../components/screens/SeriesEndScreen";
import { useGameStore } from "../../store/gameStore";
import { useSessionStore } from "../../store/sessionStore";
import { useGamePolling } from "../../hooks/useGamePolling";
import { useHeartbeat } from "../../hooks/useHeartbeat";
import { useTurnTimer } from "../../hooks/useTurnTimer";
import { useHaptics } from "../../hooks/useHaptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as api from "../../lib/api";
import type { SharedGameState } from "../../types/multiplayer";

// ── Helpers ────────────────────────────────────────────────────────────────

function dicebearUrl(seed: string) {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}

/** Map SharedGameState data into the shape GameTable / PlayerSeat expect */
function mapPlayers(state: SharedGameState) {
  return state.players.map((p) => ({
    id: p.id,
    name: p.name,
    isEliminated: p.isEliminated,
    isHuman: p.isHuman,
    seriesWins: p.seriesWins,
    avatar: p.avatar || dicebearUrl(p.id),
    wins: p.seriesWins,
  }));
}

/** Map SharedCards — annotate with the owning player's avatar for face reveal */
function mapCards(state: SharedGameState) {
  const playerMap = Object.fromEntries(state.players.map((p) => [p.id, p]));
  return state.cards.map((c) => {
    const owner = playerMap[c.ownerId];
    return {
      id: c.id,
      ownerId: c.ownerId,
      isRevealed: c.isRevealed,
      position: c.position,
      isSkull: false, // server decides skull; we show reveal via isRevealed
      playerAvatar: owner?.avatar || dicebearUrl(c.ownerId),
    };
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function GameScreen() {
  const router = useRouter();
  const playerId = useSessionStore((s) => s.playerId);
  const {
    sharedGameState,
    currentLobby,
    playerReactions,
    localSelectedTarget,
    setLocalSelectedTarget,
    setSharedGameState,
    addReaction,
    resetGameState,
  } = useGameStore();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [roundEndDismissed, setRoundEndDismissed] = useState(false);
  const [isVotingRematch, setIsVotingRematch] = useState(false);
  const [hasVotedRematch, setHasVotedRematch] = useState(false);
  const prevRoundRef = useRef<number | null>(null);

  const { onCardReveal, onElimination, onMyTurn, onWin, onButtonPress } = useHaptics();
  const insets = useSafeAreaInsets();

  // Haptics wiring
  const prevIsMyTurnRef = useRef<boolean>(false);
  const prevEliminatedCountRef = useRef<number>(0);
  const prevRevealedCountRef = useRef<number>(0);
  const prevPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sharedGameState) return;
    
    const isNowMyTurn = sharedGameState.players[sharedGameState.currentPlayerIndex]?.id === playerId;
    if (isNowMyTurn && !prevIsMyTurnRef.current && (sharedGameState.phase === "select_target" || sharedGameState.phase === "select_card")) {
      onMyTurn();
    }
    prevIsMyTurnRef.current = isNowMyTurn;

    const eliminatedCount = sharedGameState.players.filter(p => p.isEliminated).length;
    if (eliminatedCount > prevEliminatedCountRef.current) {
      onElimination();
    }
    prevEliminatedCountRef.current = eliminatedCount;

    const revealedCount = sharedGameState.cards.filter(c => c.isRevealed).length;
    if (revealedCount > prevRevealedCountRef.current) {
      onCardReveal();
    }
    prevRevealedCountRef.current = revealedCount;

    if ((sharedGameState.phase === "round_end" || sharedGameState.phase === "series_end") && prevPhaseRef.current !== sharedGameState.phase) {
      onWin();
    }
    prevPhaseRef.current = sharedGameState.phase;

  }, [sharedGameState, playerId]);

  // ── Hooks ──────────────────────────────────────────────────────────────
  useGamePolling({ enabled: true });
  useHeartbeat({ enabled: true });
  const { turnTimeRemaining, turnProgress } = useTurnTimer();

  // Reset round-dismissed flag when a new round starts
  useEffect(() => {
    const round = sharedGameState?.currentRound ?? null;
    if (round !== null && round !== prevRoundRef.current) {
      prevRoundRef.current = round;
      setRoundEndDismissed(false);
      setHasVotedRematch(false);
    }
  }, [sharedGameState?.currentRound]);

  // ── Derived state ──────────────────────────────────────────────────────
  const phase = sharedGameState?.phase ?? "waiting";
  const players = sharedGameState ? mapPlayers(sharedGameState) : [];
  const cards = sharedGameState ? mapCards(sharedGameState) : [];
  const currentPlayerIndex = sharedGameState?.currentPlayerIndex ?? 0;
  const currentPlayer = players[currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const lastMessage = sharedGameState?.lastMessage ?? "";

  // Round end
  const showRoundEnd =
    phase === "round_end" && !roundEndDismissed && !!sharedGameState?.roundWinnerId;
  const roundWinner = sharedGameState?.roundWinnerId
    ? sharedGameState.players.find(
        (p) => p.id === sharedGameState.roundWinnerId
      )
    : null;

  // Series end
  const showSeriesEnd = phase === "series_end";
  const seriesWinner = sharedGameState?.seriesWinnerId
    ? sharedGameState.players.find(
        (p) => p.id === sharedGameState.seriesWinnerId
      )
    : null;

  // Reactions map  → shape GameTable expects
  const reactionsMap: Record<string, { emoji: string; timestamp: number } | undefined> =
    Object.fromEntries(
      Object.entries(playerReactions).map(([pid, r]) => [
        pid,
        { emoji: r.emoji, timestamp: r.timestamp },
      ])
    );

  // ── Actions ────────────────────────────────────────────────────────────

  const handlePlayerPress = useCallback(
    async (targetId: string) => {
      if (!isMyTurn || phase !== "select_target" || isActing) return;
      onButtonPress();
      setLocalSelectedTarget(targetId);
      setIsActing(true);
      try {
        const newState = await api.selectTarget(playerId, targetId);
        if (newState) setSharedGameState(newState);
      } catch (err) {
        console.warn("selectTarget error:", err);
        setLocalSelectedTarget(null);
      } finally {
        setIsActing(false);
      }
    },
    [isMyTurn, phase, isActing, playerId, setLocalSelectedTarget, setSharedGameState]
  );

  const handleCardFlip = useCallback(
    async (cardId: string) => {
      if (!isMyTurn || phase !== "select_card" || isActing) return;
      onButtonPress();
      const targetId =
        localSelectedTarget ?? sharedGameState?.targetPlayerId ?? undefined;
      setIsActing(true);
      try {
        const newState = await api.selectCard(
          playerId,
          cardId,
          targetId ?? undefined
        );
        if (newState) setSharedGameState(newState);
      } catch (err) {
        console.warn("selectCard error:", err);
      } finally {
        setIsActing(false);
      }
    },
    [
      isMyTurn,
      phase,
      isActing,
      playerId,
      localSelectedTarget,
      sharedGameState?.targetPlayerId,
      setSharedGameState,
    ]
  );

  const handleEmojiSelect = async (emoji: string) => {
    onButtonPress();
    setShowEmojiPicker(false);
    if (!playerId) return;
    addReaction({ playerId, emoji, timestamp: Date.now() });
    try {
      await api.sendEmojiReaction(playerId, emoji);
    } catch {}
  };

  const handleVoteRematch = async () => {
    onButtonPress();
    if (!playerId || isVotingRematch || hasVotedRematch) return;
    setIsVotingRematch(true);
    try {
      const newState = await api.voteForRematch(playerId);
      if (newState) setSharedGameState(newState);
      setHasVotedRematch(true);
    } catch (err) {
      console.warn("voteForRematch error:", err);
    } finally {
      setIsVotingRematch(false);
    }
  };

  const handleLeaveGame = () => {
    onButtonPress();
    Alert.alert("Leave Game", "Are you sure you want to leave?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          if (playerId) {
            try {
              await api.leaveGame(playerId);
            } catch {}
          }
          resetGameState();
          router.replace("/");
        },
      },
    ]);
  };

  const handleRoundContinue = () => {
    onButtonPress();
    setRoundEndDismissed(true);
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (!sharedGameState) {
    return (
      <GlowBackground>
        <View className="flex-1 items-center justify-center">
          <Text className="font-cinzel-bold text-xl text-amber-500">
            Loading game…
          </Text>
        </View>
      </GlowBackground>
    );
  }

  // ── Phase label ────────────────────────────────────────────────────────
  const phaseLabel = (() => {
    if (!isMyTurn) return `${currentPlayer?.name ?? "?"}'s turn`;
    if (phase === "select_target") return "Choose your target";
    if (phase === "select_card") return "Choose a card to reveal";
    return "Your turn";
  })();

  return (
    <View style={styles.rootContainer}>
      <GlowBackground>
        <SafeAreaView style={[styles.safeArea, { paddingTop: Math.max(insets.top, 0), paddingBottom: Math.max(insets.bottom, 0) }]}>
          {/* ── Top bar ── */}
          <View style={styles.topBar}>
            <View style={styles.topLeft}>
              <Text style={styles.roundLabel}>
                Round {sharedGameState.currentRound}
              </Text>
              {sharedGameState.roundsToWin > 1 && (
                <Text style={styles.seriesLabel}>
                  Best of {sharedGameState.roundsToWin * 2 - 1}
                </Text>
              )}
            </View>

            <View style={styles.topCenter}>
              <Text style={styles.phaseText} numberOfLines={1}>
                {lastMessage || phaseLabel}
              </Text>
            </View>

            <Pressable style={styles.leaveBtn} onPress={handleLeaveGame}>
              <Text style={styles.leaveBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* ── Turn timer ── */}
          {(phase === "select_target" || phase === "select_card") &&
            turnTimeRemaining !== null && (
              <View style={styles.timerRow}>
                <TurnTimer
                  timeLeft={turnTimeRemaining}
                  maxTime={8}
                />
                {isMyTurn && (
                  <Text style={styles.timerText}>{turnTimeRemaining}s</Text>
                )}
              </View>
            )}

          {/* ── Game table ── */}
          <View style={styles.tableContainer}>
            <GameTable
              players={players}
              cards={cards}
              currentPlayerId={currentPlayer?.id ?? ""}
              myPlayerId={playerId}
              phase={phase}
              selectedTargetId={
                localSelectedTarget ?? sharedGameState.targetPlayerId
              }
              reactions={reactionsMap}
              onCardFlip={handleCardFlip}
              onPlayerPress={handlePlayerPress}
            />
          </View>

          {/* ── Bottom bar ── */}
          <View style={styles.bottomBar}>
            <Pressable
              style={styles.emojiButton}
              onPress={() => {
                onButtonPress();
                setShowEmojiPicker(true);
              }}
            >
              <Text style={styles.emojiButtonText}>😊</Text>
            </Pressable>

            {isMyTurn && phase === "select_target" && (
              <View style={styles.hintBubble}>
                <Text style={styles.hintText}>
                  Tap a player to select target
                </Text>
              </View>
            )}
            {isMyTurn && phase === "select_card" && (
              <View style={styles.hintBubble}>
                <Text style={styles.hintText}>
                  Tap a card to reveal
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>

        {/* ── Emoji Picker ── */}
        <EmojiPicker
          visible={showEmojiPicker}
          onSelect={handleEmojiSelect}
          onDismiss={() => setShowEmojiPicker(false)}
        />

        {/* ── Round End Modal ── */}
        {roundWinner && (
          <RoundEndScreen
            visible={showRoundEnd}
            roundNumber={sharedGameState.currentRound}
            roundsToWin={sharedGameState.roundsToWin}
            winnerId={roundWinner.id}
            winnerName={roundWinner.name}
            winnerAvatar={roundWinner.avatar || dicebearUrl(roundWinner.id)}
            seriesScores={sharedGameState.players.map((p) => ({
              id: p.id,
              name: p.name,
              seriesWins: p.seriesWins,
            }))}
            onContinue={handleRoundContinue}
          />
        )}

        {/* ── Series End Modal ── */}
        <SeriesEndScreen
          visible={showSeriesEnd}
          winnerId={seriesWinner?.id ?? null}
          winnerName={seriesWinner?.name ?? "Unknown"}
          winnerAvatar={
            seriesWinner?.avatar || dicebearUrl(seriesWinner?.id ?? "")
          }
          myPlayerId={playerId}
          rematchVotes={sharedGameState.rematchVotes ?? []}
          totalPlayers={sharedGameState.players.length}
          isVoting={isVotingRematch}
          hasVoted={hasVotedRematch}
          onVoteRematch={handleVoteRematch}
          onLeave={() => {
            onButtonPress();
            resetGameState();
            router.replace("/");
          }}
        />
      </GlowBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#0c0a09",
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    minHeight: 48,
  },
  topLeft: {
    width: 70,
  },
  roundLabel: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 12,
    color: "#d97706",
    letterSpacing: 0.5,
  },
  seriesLabel: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 9,
    color: "#78716c",
  },
  topCenter: {
    flex: 1,
    alignItems: "center",
  },
  phaseText: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 12,
    color: "#a8a29e",
    textAlign: "center",
  },
  leaveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  leaveBtnText: {
    color: "#78716c",
    fontSize: 16,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 4,
  },
  timerText: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 12,
    color: "#d97706",
    width: 28,
    textAlign: "right",
  },
  tableContainer: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 12,
    minHeight: 60,
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3d3833",
  },
  emojiButtonText: {
    fontSize: 22,
  },
  hintBubble: {
    flex: 1,
    backgroundColor: "rgba(201,168,76,0.12)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#c9a84c33",
  },
  hintText: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 12,
    color: "#c9a84c",
    textAlign: "center",
  },
});
