import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate } from 'react-native-reanimated';

export interface CardComponentProps {
  card: { id: string, isSkull: boolean };
  canFlip: boolean;
  onFlip: (id: string) => void;
  isRevealed: boolean;
  playerAvatar: string;
  size: number;
}

export const CardComponent: React.FC<CardComponentProps> = ({ card, canFlip, onFlip, isRevealed, playerAvatar, size }) => {
  const flipValue = useSharedValue(isRevealed ? 1 : 0);

  useEffect(() => {
    flipValue.value = withTiming(isRevealed ? 1 : 0, { duration: 300 });
  }, [isRevealed, flipValue]);

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipValue.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipValue.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
    };
  });

  return (
    <Pressable onPress={() => canFlip && !isRevealed && onFlip(card.id)} style={[styles.container, { width: size, height: size * 1.5 }]}>
      <Animated.View style={[styles.card, styles.front, frontStyle]}>
        <View style={styles.frontContent} />
      </Animated.View>
      <Animated.View style={[styles.card, styles.back, backStyle]}>
        <Image source={{ uri: playerAvatar }} style={styles.avatar} />
        {card.isSkull && <Text style={styles.skull}>💀</Text>}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 4,
  },
  card: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  front: {
    backgroundColor: '#FFBF00', // Amber background
  },
  frontContent: {
    flex: 1,
    backgroundColor: '#FFBF00',
  },
  back: {
    backgroundColor: '#fff',
  },
  avatar: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
  skull: {
    position: 'absolute',
    fontSize: 32,
  }
});
