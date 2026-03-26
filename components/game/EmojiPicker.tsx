import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  Pressable,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

const EMOJI_SETS = {
  reactions: ['😂', '😱', '🤔', '😏', '🔥', '💀', '👀', '🎯'],
  taunts: ['😈', '🤡', '💅', '🧠', '🫡', '🤫', '👻', '🪦'],
  feelings: ['😰', '😤', '🥶', '🫠', '🤯', '😇', '🥹', '😵‍💫'],
};

interface EmojiPickerProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onDismiss: () => void;
}

export default function EmojiPicker({ visible, onSelect, onDismiss }: EmojiPickerProps) {
  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={onDismiss}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.picker}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.entries(EMOJI_SETS).map(([category, emojis]) => (
                <View key={category}>
                  <Text style={styles.categoryLabel}>{category}</Text>
                  <View style={styles.emojiRow}>
                    {emojis.map((emoji) => (
                      <Pressable
                        key={emoji}
                        onPress={() => onSelect(emoji)}
                        style={({ pressed }) => [
                          styles.emojiButton,
                          pressed && styles.emojiPressed,
                        ]}
                      >
                        <Text style={styles.emojiText}>{emoji}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 80,
    zIndex: 100,
  },
  picker: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 16,
    width: '85%',
    maxHeight: 320,
    borderWidth: 1,
    borderColor: '#c9a84c44',
  },
  categoryLabel: {
    color: '#c9a84c',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 8,
    fontFamily: 'Cinzel_400Regular',
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiPressed: {
    backgroundColor: 'rgba(201,168,76,0.3)',
    transform: [{ scale: 1.15 }],
  },
  emojiText: {
    fontSize: 24,
  },
});
