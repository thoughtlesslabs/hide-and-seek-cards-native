import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { PlayerSeat } from './PlayerSeat';
import { CardGrid } from './CardGrid';

export interface GameTableProps {
  players: any[];
  cards: any[];
  currentPlayerId: string;
  onCardFlip: (id: string) => void;
}

export const GameTable: React.FC<GameTableProps> = ({ players, cards, currentPlayerId, onCardFlip }) => {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.42;
  const ry = height * 0.38;
  const total = players.length;

  return (
    <View style={styles.container}>
      {players.map((player, i) => {
        const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
        const x = cx + rx * Math.cos(angle) - 30; // offset by half width
        const y = cy + ry * Math.sin(angle) - 40; // offset by half height
        
        return (
          <View key={player.id} style={[styles.seatWrapper, { left: x, top: y }]}>
            <PlayerSeat 
              player={player} 
              isMyTurn={player.id === currentPlayerId} 
              isEliminated={player.isEliminated} 
            />
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
    backgroundColor: '#2c3e50',
  },
  seatWrapper: {
    position: 'absolute',
  },
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
