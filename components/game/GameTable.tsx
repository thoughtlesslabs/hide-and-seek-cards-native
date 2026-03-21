import React from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { PlayerSeat } from './PlayerSeat';
import { CardGrid } from './CardGrid';

export interface GameTableProps {
  players: any[];
  cards: any[];
  currentPlayerId: string;
  myPlayerId?: string;
  /** Phase — controls whether seats are pressable */
  phase?: string;
  selectedTargetId?: string | null;
  reactions?: Record<string, { emoji: string; timestamp: number } | undefined>;
  onCardFlip: (id: string) => void;
  onPlayerPress?: (playerId: string) => void;
}

export const GameTable: React.FC<GameTableProps> = ({
  players,
  cards,
  currentPlayerId,
  myPlayerId,
  phase,
  selectedTargetId,
  reactions = {},
  onCardFlip,
  onPlayerPress,
}) => {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.40;
  const ry = height * 0.36;
  const total = players.length;

  const canSelectTarget = phase === 'select_target' && onPlayerPress;

  return (
    <View style={styles.container}>
      {players.map((player, i) => {
        const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
        const x = cx + rx * Math.cos(angle) - 36;
        const y = cy + ry * Math.sin(angle) - 50;
        const isSelected = selectedTargetId === player.id;
        const reaction = reactions[player.id];

        return (
          <View key={player.id} style={[styles.seatWrapper, { left: x, top: y }]}>
            {canSelectTarget && !player.isEliminated && player.id !== myPlayerId ? (
              <Pressable onPress={() => onPlayerPress?.(player.id)}>
                <PlayerSeat
                  player={player}
                  isMyTurn={player.id === currentPlayerId}
                  isEliminated={player.isEliminated}
                  reactionEmoji={reaction?.emoji}
                  isSelected={isSelected}
                />
              </Pressable>
            ) : (
              <PlayerSeat
                player={player}
                isMyTurn={player.id === currentPlayerId}
                isEliminated={player.isEliminated}
                reactionEmoji={reaction?.emoji}
                isSelected={isSelected}
              />
            )}
          </View>
        );
      })}

      <View style={styles.centerContainer}>
        <CardGrid cards={cards} onFlip={onCardFlip} canFlipCardId={currentPlayerId} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  seatWrapper: {
    position: 'absolute',
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
