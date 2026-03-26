import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Image,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

interface SeriesEndScreenProps {
  visible: boolean;
  winnerId: string | null;
  winnerName: string;
  winnerAvatar?: string;
  myPlayerId: string;
  /** IDs that have already voted for rematch */
  rematchVotes: string[];
  totalPlayers: number;
  isVoting: boolean;
  hasVoted: boolean;
  onVoteRematch: () => void;
  onLeave: () => void;
}

export default function SeriesEndScreen({
  visible,
  winnerId,
  winnerName,
  winnerAvatar,
  myPlayerId,
  rematchVotes,
  totalPlayers,
  isVoting,
  hasVoted,
  onVoteRematch,
  onLeave,
}: SeriesEndScreenProps) {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const crownBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Crown bounce
      Animated.loop(
        Animated.sequence([
          Animated.timing(crownBounce, {
            toValue: -10,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(crownBounce, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(0);
      crownBounce.stopAnimation();
      crownBounce.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim, crownBounce]);

  const isWinner = myPlayerId === winnerId;
  const avatarUri =
    winnerAvatar ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(winnerId || winnerName)}`;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Crown */}
          <Animated.Text
            style={[
              styles.crown,
              { transform: [{ translateY: crownBounce }] },
            ]}
          >
            👑
          </Animated.Text>

          {/* Title */}
          <Text style={styles.title}>
            {isWinner ? "You Won!" : "Game Over"}
          </Text>

          {/* Winner avatar */}
          <View style={styles.avatarRing}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          </View>

          {/* Winner label */}
          <Text style={styles.winnerName}>{winnerName}</Text>
          <Text style={styles.winnerSub}>
            {isWinner ? "Congratulations! 🎉" : "wins the series"}
          </Text>

          {/* Rematch votes progress */}
          <View style={styles.rematchSection}>
            <Text style={styles.rematchLabel}>
              Rematch Votes: {rematchVotes.length} / {totalPlayers}
            </Text>
            <View style={styles.votesBar}>
              <View
                style={[
                  styles.votesBarFill,
                  {
                    width: `${Math.min(
                      100,
                      (rematchVotes.length / Math.max(1, totalPlayers)) * 100
                    )}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Rematch / Leave buttons */}
          <View style={styles.btnRow}>
            {!hasVoted ? (
              <Pressable
                style={[
                  styles.rematchBtn,
                  isVoting && styles.rematchBtnDisabled,
                ]}
                onPress={onVoteRematch}
                disabled={isVoting}
              >
                {isVoting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.rematchBtnText}>🔄  Rematch</Text>
                )}
              </Pressable>
            ) : (
              <View style={[styles.rematchBtn, styles.rematchBtnVoted]}>
                <Text style={styles.rematchBtnText}>✓  Voted</Text>
              </View>
            )}

            <Pressable style={styles.leaveBtn} onPress={onLeave}>
              <Text style={styles.leaveBtnText}>Leave</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#1c1917",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#c9a84c66",
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
  },
  crown: {
    fontSize: 48,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 26,
    color: "#fbbf24",
    letterSpacing: 2,
    marginBottom: 16,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "#FFBF00",
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#FFBF00",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  avatar: {
    width: 90,
    height: 90,
  },
  winnerName: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 20,
    color: "#fde68a",
    textAlign: "center",
    marginBottom: 4,
  },
  winnerSub: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 13,
    color: "#78716c",
    marginBottom: 20,
  },
  rematchSection: {
    width: "100%",
    marginBottom: 20,
  },
  rematchLabel: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 11,
    color: "#78716c",
    textAlign: "center",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  votesBar: {
    height: 5,
    backgroundColor: "#292524",
    borderRadius: 3,
    overflow: "hidden",
  },
  votesBarFill: {
    height: "100%",
    backgroundColor: "#FFBF00",
    borderRadius: 3,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  rematchBtn: {
    flex: 1,
    backgroundColor: "#b45309",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  rematchBtnDisabled: {
    opacity: 0.6,
  },
  rematchBtnVoted: {
    backgroundColor: "#44403c",
  },
  rematchBtnText: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 14,
    color: "#fff",
  },
  leaveBtn: {
    flex: 1,
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#44403c",
    alignItems: "center",
  },
  leaveBtnText: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 14,
    color: "#78716c",
  },
});
