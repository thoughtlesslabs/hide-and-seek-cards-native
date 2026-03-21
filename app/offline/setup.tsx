import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  Image,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { GlowBackground } from "../../components/ui/GlowBackground";
import { OfflineGameConfig } from "../../hooks/useOfflineGame";

const PLAYER_COUNTS = [4, 6, 8];
const ROUNDS_OPTIONS = [1, 2, 3];

const HUMAN_NAMES = ["You", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6", "Player 7", "Player 8"];

const BOT_NAMES = [
  "ShadowWolf", "MysticPhoenix", "ThunderDragon", "SilentFalcon",
  "BlazingKnight", "CosmicWizard", "FrozenSerpent", "SwiftHunter",
];

export default function OfflineSetupScreen() {
  const router = useRouter();
  const [playerCount, setPlayerCount] = useState(4);
  const [roundsToWin, setRoundsToWin] = useState(2);
  const [humanSlots, setHumanSlots] = useState<boolean[]>([true, false, false, false]);
  const [playerNames, setPlayerNames] = useState<string[]>(["You", "", "", ""]);

  const handlePlayerCountChange = useCallback((count: number) => {
    setPlayerCount(count);
    const newHumanSlots: boolean[] = [];
    const newNames: string[] = [];
    for (let i = 0; i < count; i++) {
      newHumanSlots.push(i === 0);
      newNames.push(i === 0 ? "You" : "");
    }
    setHumanSlots(newHumanSlots);
    setPlayerNames(newNames);
  }, []);

  const handleHumanToggle = useCallback((index: number) => {
    setHumanSlots(prev => {
      const newSlots = [...prev];
      newSlots[index] = !newSlots[index];
      const humanCount = newSlots.filter(Boolean).length;
      if (humanCount === 0) {
        newSlots[0] = true;
        setPlayerNames(p => {
          const n = [...p];
          n[0] = HUMAN_NAMES[0];
          return n;
        });
      } else {
        setPlayerNames(p => {
          const n = [...p];
          n[index] = newSlots[index] ? HUMAN_NAMES[index] : "";
          return n;
        });
      }
      return newSlots;
    });
  }, []);

  const regenerateBotName = useCallback((index: number) => {
    const randomName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 100);
    setPlayerNames(prev => {
      const newNames = [...prev];
      newNames[index] = randomName;
      return newNames;
    });
  }, []);

  const humanCount = humanSlots.filter(Boolean).length;
  const canStart = humanCount >= 1;

  const handleStartGame = useCallback(() => {
    const config: OfflineGameConfig = {
      playerCount,
      humanSlots,
      playerNames,
      roundsToWin,
    };
    router.push({
      pathname: "/offline/game",
      params: { config: JSON.stringify(config) },
    });
  }, [playerCount, humanSlots, playerNames, roundsToWin, router]);

  return (
    <GlowBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Offline Setup</Text>
        <Text style={styles.subtitle}>Configure your game</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Players</Text>
          <View style={styles.playerCountRow}>
            {PLAYER_COUNTS.map(count => (
              <Pressable
                key={count}
                style={[
                  styles.playerCountBtn,
                  playerCount === count && styles.playerCountBtnActive,
                ]}
                onPress={() => handlePlayerCountChange(count)}
              >
                <Text style={[
                  styles.playerCountText,
                  playerCount === count && styles.playerCountTextActive,
                ]}>
                  {count}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.playerList}>
            {Array.from({ length: playerCount }).map((_, index) => (
              <View key={index} style={styles.playerRow}>
                <Image
                  source={{
                    uri: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(playerNames[index] || `player${index}`)}`,
                  }}
                  style={styles.avatar}
                />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {playerNames[index] || HUMAN_NAMES[index] || `Player ${index + 1}`}
                  </Text>
                  <Text style={styles.playerType}>
                    {humanSlots[index] ? "Human" : "Computer"}
                  </Text>
                </View>
                {!humanSlots[index] && (
                  <Pressable
                    style={styles.refreshBtn}
                    onPress={() => regenerateBotName(index)}
                  >
                    <Text style={styles.refreshBtnText}>🎲</Text>
                  </Pressable>
                )}
                <View style={styles.switchContainer}>
                  <Switch
                    value={humanSlots[index]}
                    onValueChange={() => handleHumanToggle(index)}
                    trackColor={{ false: "#44403c", true: "#b45309" }}
                    thumbColor={humanSlots[index] ? "#FFBF00" : "#a8a29e"}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rounds to Win Series</Text>
          <View style={styles.roundsRow}>
            {ROUNDS_OPTIONS.map(rounds => (
              <Pressable
                key={rounds}
                style={[
                  styles.roundBtn,
                  roundsToWin === rounds && styles.roundBtnActive,
                ]}
                onPress={() => setRoundsToWin(rounds)}
              >
                <Text style={[
                  styles.roundText,
                  roundsToWin === rounds && styles.roundTextActive,
                ]}>
                  {rounds} {rounds === 1 ? "Round" : "Rounds"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          onPress={handleStartGame}
          disabled={!canStart}
        >
          <Text style={styles.startBtnText}>Start Game</Text>
        </Pressable>
      </ScrollView>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 28,
    color: "#fbbf24",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 14,
    color: "#92400e",
    textAlign: "center",
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 14,
    color: "#d6d3d1",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 12,
  },
  playerCountRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  playerCountBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#292524",
    borderWidth: 1,
    borderColor: "#44403c",
    alignItems: "center",
  },
  playerCountBtnActive: {
    backgroundColor: "#b45309",
    borderColor: "#FFBF00",
  },
  playerCountText: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 18,
    color: "#78716c",
  },
  playerCountTextActive: {
    color: "#fff",
  },
  playerList: {
    gap: 12,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1917",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#292524",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#292524",
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 16,
    color: "#f5f5f4",
    marginBottom: 2,
  },
  playerType: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 11,
    color: "#78716c",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#292524",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  refreshBtnText: {
    fontSize: 18,
  },
  switchContainer: {
    marginLeft: 8,
  },
  roundsRow: {
    flexDirection: "row",
    gap: 12,
  },
  roundBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#292524",
    borderWidth: 1,
    borderColor: "#44403c",
    alignItems: "center",
  },
  roundBtnActive: {
    backgroundColor: "#b45309",
    borderColor: "#FFBF00",
  },
  roundText: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 13,
    color: "#78716c",
  },
  roundTextActive: {
    color: "#fff",
  },
  startBtn: {
    backgroundColor: "#b45309",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 16,
    shadowColor: "#d97706",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  startBtnDisabled: {
    backgroundColor: "#44403c",
    shadowOpacity: 0,
  },
  startBtnText: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 18,
    color: "#fff",
    letterSpacing: 2,
  },
});
