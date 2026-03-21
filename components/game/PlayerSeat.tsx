import React from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';

export interface PlayerSeatProps {
  player: any;
  isMyTurn: boolean;
  isEliminated: boolean;
  reactionEmoji?: string;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({ player, isMyTurn, isEliminated, reactionEmoji }) => {
  return (
    <View style={[styles.container, isMyTurn && styles.active, isEliminated && styles.eliminated]}>
      <View style={[styles.avatarContainer, isMyTurn && styles.activeRing]}>
        <Image source={{ uri: player.avatar || 'https://api.dicebear.com/7.x/bottts/png' }} style={styles.avatar} />
        {reactionEmoji && <Text style={styles.reaction}>{reactionEmoji}</Text>}
      </View>
      <Text style={styles.name}>{player.name}</Text>
      <View style={styles.dotsContainer}>
        {[...Array(player.wins || 0)].map((_, i) => (
          <View key={i} style={styles.winDot} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    transform: [{ scale: 1.1 }],
  },
  eliminated: {
    opacity: 0.5,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#ddd',
  },
  activeRing: {
    borderColor: '#FFBF00',
    borderWidth: 3,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  reaction: {
    position: 'absolute',
    top: -10,
    right: -10,
    fontSize: 20,
  },
  name: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 2,
  },
  winDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFBF00',
    marginHorizontal: 2,
  },
});
