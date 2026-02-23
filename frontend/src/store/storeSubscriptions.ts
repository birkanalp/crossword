import { useUserStore } from './userStore';
import { useSettingsStore } from './settingsStore';
import { saveUser, saveProfile, saveStreak, saveSettings } from '@/persistence/userStorage';

// ─── Store Subscriptions ──────────────────────────────────────────────────────
// Persist store slices to AsyncStorage whenever they change.
// Call setupStoreSubscriptions() once in app/_layout.tsx after hydration.

export function setupStoreSubscriptions(): () => void {
  const unsubUser = useUserStore.subscribe(
    (state) => state.user,
    (user) => {
      if (user) void saveUser(user);
    },
  );

  const unsubProfile = useUserStore.subscribe(
    (state) => state.profile,
    (profile) => {
      if (profile) void saveProfile(profile);
    },
  );

  const unsubStreak = useUserStore.subscribe(
    (state) => state.streak,
    (streak) => {
      void saveStreak(streak);
    },
  );

  const unsubSettings = useSettingsStore.subscribe(
    (state) => ({
      soundEnabled: state.soundEnabled,
      hapticsEnabled: state.hapticsEnabled,
      theme: state.theme,
      showTimer: state.showTimer,
      showMistakeCount: state.showMistakeCount,
    }),
    (settings) => {
      void saveSettings(settings);
    },
  );

  // Return a cleanup function
  return () => {
    unsubUser();
    unsubProfile();
    unsubStreak();
    unsubSettings();
  };
}
