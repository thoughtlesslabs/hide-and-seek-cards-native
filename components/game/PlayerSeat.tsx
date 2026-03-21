import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export interface PlayerSeatProps {
  player: any;
  isMyTurn: boolean;
  isEliminated: boolean;
  reactionEmoji?: string;
  isSelected?: boolean;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isMyTurn,
  isEliminated,
  reactionEmoji,
  isSelected = false,
}) => {
  const avatarUri =
    player.avatar ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.id || player.name || 'player')}`;

  return (
    <View style={[styles.container, isEliminated && styles.eliminated]}>
      <View
        style={[
          styles.avatarContainer,
          isMyTurn && styles.activeTurnRing,
          isSelected && styles.selectedRing,
        ]}
      >
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
        {reactionEmoji ? (
          <Text style={styles.reaction}>{reactionEmoji}</Text>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {player.name}
      </Text>
      {/* Series win dots */}
      {(player.seriesWins ?? 0) > 0 && (
        <View style={styles.dotsContainer}>
          {[...Array(player.seriesWins)].map((_: undefined, i: number) => (
            <View key={i} style={styles.winDot} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
  },
  eliminated: {
    opacity: 0.35,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1c1917',
    overflow: 'visible',
    position: 'relative',
  },
  activeTurnRing: {
    borderColor: '#FFBF00',
    borderWidth: 3,
  },
  selectedRing: {
    borderColor: '#ef4444',
    borderWidth: 3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  reaction: {
    position: 'absolute',
    top: -12,
    right: -12,
    fontSize: 20,
    zIndex: 10,
  },
  name: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#d6d3d1',
    textAlign: 'center',
    maxWidth: 72,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 2,
    gap: 3,
  },
  winDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFBF00',
  },
});
