import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export interface TurnTimerProps {
  timeLeft: number;
  maxTime?: number;
}

export const TurnTimer: React.FC<TurnTimerProps> = ({ timeLeft, maxTime = 8 }) => {
  const animatedValue = useRef(new Animated.Value(timeLeft)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: timeLeft,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [timeLeft, animatedValue]);

  const widthPct = animatedValue.interpolate({
    inputRange: [0, maxTime],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  // Color shifts from amber → red as time runs out
  const barColor = timeLeft <= 2 ? '#ef4444' : timeLeft <= 4 ? '#f97316' : '#FFBF00';

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.bar, { width: widthPct, backgroundColor: barColor }]} />
    </View>
  );
};

export default TurnTimer;

const styles = StyleSheet.create({
  container: {
    height: 6,
    width: '100%',
    backgroundColor: '#292524',
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
});
