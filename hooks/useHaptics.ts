import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../store/settingsStore';

export function useHaptics() {
  const hapticEnabled = useSettingsStore((s) => s.hapticEnabled);

  const onCardReveal = async () => {
    if (!hapticEnabled) return;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  };

  const onElimination = async () => {
    if (!hapticEnabled) return;
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
  };

  const onMyTurn = async () => {
    if (!hapticEnabled) return;
    try { await Haptics.selectionAsync(); } catch {}
  };

  const onWin = async () => {
    if (!hapticEnabled) return;
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  };

  const onButtonPress = async () => {
    if (!hapticEnabled) return;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  };

  return { onCardReveal, onElimination, onMyTurn, onWin, onButtonPress };
}
