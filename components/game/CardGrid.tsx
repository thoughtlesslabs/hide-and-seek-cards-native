import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CardComponent } from './CardComponent';

export interface CardGridProps {
  cards: any[];
  onFlip: (id: string) => void;
  canFlipCardId?: string;
}

export const CardGrid: React.FC<CardGridProps> = ({ cards, onFlip, canFlipCardId }) => {
  const isEight = cards.length > 4;
  
  return (
    <View style={[styles.container, { width: isEight ? 300 : 150 }]}>
      {cards.map((card) => (
        <CardComponent
          key={card.id}
          card={card}
          canFlip={!!canFlipCardId}
          onFlip={onFlip}
          isRevealed={card.isRevealed}
          playerAvatar={card.playerAvatar || 'https://api.dicebear.com/7.x/bottts/png'}
          size={60}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
