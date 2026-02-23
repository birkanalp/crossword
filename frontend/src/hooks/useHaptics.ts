import * as Haptics from 'expo-haptics';
import { useSettingsStore, selectHapticsEnabled } from '@/store/settingsStore';

// ─── Haptics Hook ─────────────────────────────────────────────────────────────
// Respects the user's haptics setting from settingsStore.

export function useHaptics() {
  const hapticsEnabled = useSettingsStore(selectHapticsEnabled);

  const light = () => {
    if (!hapticsEnabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const medium = () => {
    if (!hapticsEnabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const heavy = () => {
    if (!hapticsEnabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const success = () => {
    if (!hapticsEnabled) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const error = () => {
    if (!hapticsEnabled) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const warning = () => {
    if (!hapticsEnabled) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  return { light, medium, heavy, success, error, warning };
}
