import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, SafeAreaView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GlowBackground } from "../../components/ui/GlowBackground";
import { GameTable } from "../../components/game/GameTable";
import { TurnTimer } from "../../components/game/TurnTimer";
import RoundEndScreen from "../../components/screens/RoundEndScreen";
import SeriesEndScreen from "../../components/screens/SeriesEndScreen";
import { useOfflineGame, OfflineGameConfig, useOfflineTimer } from "../../hooks/useOfflineGame";
import { GamePhase } from "../../types/game";

export default function OfflineGameScreen() {
  const { config: configJson } = useLocalSearchParams<{ config: string }>();
  const router = useRouter();

  const config: OfflineGameConfig = useMemo(() => {
    try {
      return JSON.parse(configJson || "{}");
    } catch {
      return {
        playerCount: 4,
        humanSlots: [true, false, false, false],
        playerNames: ["You", "", "", ""],
        roundsToWin: 2,
      };
    }
  }, [configJson]);

  const [gameState, gameActions] = useOfflineGame(config);
  const { turnTimeRemaining, turnProgress } = useOfflineTimer(
    gameState.turnStartTime,
    gameState.phase
  );

  const myPlayerId = useMemo(() => {
    const humanPlayer = gameState.players.find(p => p.isHuman);
    return humanPlayer?.id || gameState.players[0]?.id || "";
  }, [gameState.players]);

  const currentPlayerId = gameState.players[gameState.currentPlayerIndex]?.id || "";

  const cardsWithPlayerAvatars = useMemo(() => {
    return gameState.cards.map(card => {
      const owner = gameState.players.find(p => p.id === card.ownerId);
      return {
        ...card,
        playerAvatar: owner?.avatar || "",
      };
    });
  }, [gameState.cards]);

  const seriesScores = useMemo(() => {
    return gameState.players.map(p => ({
      id: p.id,
      name: p.name,
      seriesWins: (p as any).seriesWins || 0,
    }));
  }, [gameState.players]);

  const handleCardFlip = (cardId: string) => {
    gameActions.selectCard(cardId);
  };

  const handlePlayerPress = (playerId: string) => {
    gameActions.selectTarget(playerId);
  };

  const handleRoundContinue = () => {
    gameActions.continueRound();
  };

  const handleRematch = () => {
    gameActions.rematchSeries();
  };

  const handleLeave = () => {
    gameActions.leaveGame();
    router.push("/");
  };

  const isMyTurn = currentPlayerId === myPlayerId && !gameState.players[gameState.currentPlayerIndex]?.isEliminated;
  const canAct = isMyTurn && (gameState.phase === GamePhase.SELECT_TARGET || gameState.phase === GamePhase.SELECT_CARD);

  const getPhaseHint = () => {
    switch (gameState.phase) {
      case GamePhase.SELECT_TARGET:
        return isMyTurn ? "Choose your target" : `${gameState.players[gameState.currentPlayerIndex]?.name}'s turn`;
      case GamePhase.SELECT_CARD:
        return isMyTurn ? "Choose a card to flip" : `${gameState.players[gameState.currentPlayerIndex]?.name} is choosing a card`;
      case GamePhase.REVEAL_RESULT:
        return "Revealing...";
      case GamePhase.GAME_OVER:
        return gameState.winner ? `${gameState.winner.name} wins!` : "";
      default:
        return "";
    }
  };

  return (
    <GlowBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.roundInfo}>
            <Text style={styles.roundLabel}>Round {gameState.roundNumber}</Text>
            <Text style={styles.roundsToWin}>
              First to {config.roundsToWin} wins
            </Text>
          </View>
          <Pressable style={styles.leaveBtn} onPress={handleLeave}>
            <Text style={styles.leaveBtnText}>✕</Text>
          </Pressable>
        </View>

        {(gameState.phase === GamePhase.SELECT_TARGET || gameState.phase === GamePhase.SELECT_CARD) && (
          <View style={styles.timerContainer}>
            <TurnTimer
              timeLeft={turnTimeRemaining ?? 8}
            />
          </View>
        )}

        <View style={styles.hintContainer}>
          <Text style={[styles.hint, canAct && styles.hintActive]}>
            {getPhaseHint()}
          </Text>
        </View>

        <View style={styles.tableContainer}>
          <GameTable
            players={gameState.players}
            cards={cardsWithPlayerAvatars}
            currentPlayerId={currentPlayerId}
            myPlayerId={myPlayerId}
            phase={gameState.phase}
            selectedTargetId={gameState.targetPlayerId}
            reactions={{}}
            onCardFlip={handleCardFlip}
            onPlayerPress={gameState.phase === GamePhase.SELECT_TARGET ? handlePlayerPress : undefined}
          />
        </View>

        <View style={styles.seriesScoreBar}>
          {gameState.players.slice(0, 4).map(player => (
            <View key={player.id} style={styles.scoreItem}>
              <Text style={styles.scoreName} numberOfLines={1}>
                {player.name}
              </Text>
              <View style={styles.scoreDots}>
                {Array.from({ length: config.roundsToWin }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.scoreDot,
                      (player as any).seriesWins > i && styles.scoreDotFilled,
                    ]}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>

        <RoundEndScreen
          visible={gameState.isRoundEnd && !gameState.isSeriesEnd}
          roundNumber={gameState.roundNumber}
          roundsToWin={config.roundsToWin}
          winnerId={gameState.winner?.id || null}
          winnerName={gameState.winner?.name || "Unknown"}
          winnerAvatar={gameState.winner?.avatar}
          seriesScores={seriesScores}
          onContinue={handleRoundContinue}
        />

        <SeriesEndScreen
          visible={gameState.isSeriesEnd}
          winnerId={gameState.seriesWinner?.id || null}
          winnerName={gameState.seriesWinner?.name || "Unknown"}
          winnerAvatar={gameState.seriesWinner?.avatar}
          myPlayerId={myPlayerId}
          rematchVotes={[]}
          totalPlayers={config.playerCount}
          isVoting={false}
          hasVoted={false}
          onVoteRematch={handleRematch}
          onLeave={handleLeave}
        />
      </SafeAreaView>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  roundInfo: {
    alignItems: "flex-start",
  },
  roundLabel: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 16,
    color: "#fbbf24",
  },
  roundsToWin: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 11,
    color: "#78716c",
    marginTop: 2,
  },
  leaveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#292524",
    alignItems: "center",
    justifyContent: "center",
  },
  leaveBtnText: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 16,
    color: "#78716c",
  },
  timerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  hintContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  hint: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 14,
    color: "#78716c",
  },
  hintActive: {
    fontFamily: "Cinzel_700Bold",
    fontSize: 16,
    color: "#fbbf24",
  },
  tableContainer: {
    flex: 1,
  },
  seriesScoreBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1c1917",
    borderTopWidth: 1,
    borderTopColor: "#292524",
  },
  scoreItem: {
    alignItems: "center",
  },
  scoreName: {
    fontFamily: "Cinzel_400Regular",
    fontSize: 10,
    color: "#d6d3d1",
    marginBottom: 4,
    maxWidth: 60,
  },
  scoreDots: {
    flexDirection: "row",
    gap: 4,
  },
  scoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#57534e",
    backgroundColor: "transparent",
  },
  scoreDotFilled: {
    backgroundColor: "#FFBF00",
    borderColor: "#FFBF00",
  },
});
