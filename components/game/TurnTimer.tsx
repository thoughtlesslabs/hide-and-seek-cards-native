import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export interface TurnTimerProps {
  timeLeft: number;
  maxTime: number;
}

export const TurnTimer: React.FC<TurnTimerProps> = ({ timeLeft, maxTime }) => {
  const animatedValue = useRef(new Animated.Value(timeLeft)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: timeLeft,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [timeLeft]);

  const width = animatedValue.interpolate({
    inputRange: [0, maxTime],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.bar, { width }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 8,
    width: '100%',
    backgroundColor: '#ccc',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: '#FFBF00',
  }
});
