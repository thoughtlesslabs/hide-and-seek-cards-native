import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Image,
  Animated,
  StyleSheet,
} from "react-native";

interface RoundEndScreenProps {
  visible: boolean;
  roundNumber: number;
  roundsToWin: number;
  winnerId: string | null;
  winnerName: string;
  winnerAvatar?: string;
  /** Each player's series win count */
  seriesScores: Array<{ id: string; name: string; seriesWins: number }>;
  onContinue: () => void;
}

export default function RoundEndScreen({
  visible,
  roundNumber,
  roundsToWin,
  winnerId,
  winnerName,
  winnerAvatar,
  seriesScores,
  onContinue,
}: RoundEndScreenProps) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.6);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

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
          {/* Header */}
          <Text style={styles.headerLabel}>Round {roundNumber} Over</Text>

          {/* Trophy */}
          <Text style={styles.trophy}>🏆</Text>

          {/* Winner avatar */}
          <View style={styles.avatarRing}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          </View>

          {/* Winner name */}
          <Text style={styles.winnerName}>{winnerName}</Text>
          <Text style={styles.winnerSub}>wins the round!</Text>

          {/* Series score bar */}
          {seriesScores.length > 0 && roundsToWin > 1 && (
            <View style={styles.scoreSection}>
              <Text style={styles.scoreTitle}>Series Score</Text>
              {seriesScores.slice(0, 4).map((p) => (
                <View key={p.id} style={styles.scoreRow}>
                  <Text style={styles.scoreName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <View style={styles.scoreDots}>
                    {Array.from({ length: roundsToWin }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.scoreDot,
                          i < p.seriesWins && styles.scoreDotFilled,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Continue button */}
          <Pressable style={styles.continueBtn} onPress={onContinue}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#1c1917",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#c9a84c44",
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
  },
  headerLabel: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 13,
    color: "#92400e",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  trophy: {
    fontSize: 40,
    marginBottom: 12,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFBF00",
    overflow: "hidden",
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
  },
  winnerName: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 22,
    color: "#fbbf24",
    textAlign: "center",
    marginBottom: 4,
  },
  winnerSub: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 13,
    color: "#92400e",
    marginBottom: 20,
  },
  scoreSection: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  scoreTitle: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 10,
    color: "#78716c",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: "center",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  scoreName: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 12,
    color: "#d6d3d1",
    flex: 1,
    marginRight: 8,
  },
  scoreDots: {
    flexDirection: "row",
    gap: 4,
  },
  scoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#57534e",
    backgroundColor: "transparent",
  },
  scoreDotFilled: {
    backgroundColor: "#FFBF00",
    borderColor: "#FFBF00",
  },
  continueBtn: {
    backgroundColor: "#b45309",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: "100%",
    alignItems: "center",
  },
  continueBtnText: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 16,
    color: "#fff",
    letterSpacing: 1,
  },
});
