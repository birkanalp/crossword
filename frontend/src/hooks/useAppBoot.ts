import { useEffect, useState } from 'react';
import { useUserStore } from '@/store/userStore';
import { useSettingsStore } from '@/store/settingsStore';
import { loadUser, loadProfile, loadStreak, loadSettings } from '@/persistence/userStorage';
import { setUserContext } from '@/lib/sentry';
import { initAnalytics } from '@/lib/analytics';
import { initRevenueCat } from '@/lib/revenuecat';
import { createGuestUser } from '@/domain/user/guest';

// ─── App Boot Hook ────────────────────────────────────────────────────────────
// Runs on first mount. Restores persisted user + settings, or creates guest.
// Returns true when hydration is complete.

export function useAppBoot(): { isReady: boolean } {
  const [isReady, setIsReady] = useState(false);
  const { hydrateUser, initGuest } = useUserStore.getState();
  const { hydrateSettings } = useSettingsStore.getState();

  useEffect(() => {
    async function boot() {
      // 1. Restore settings first (theme, haptics, etc.)
      const savedSettings = await loadSettings();
      if (savedSettings) {
        hydrateSettings(savedSettings as Parameters<typeof hydrateSettings>[0]);
      } else {
        hydrateSettings({});
      }

      // 2. Restore or create user
      const savedUser = await loadUser();

      if (savedUser) {
        const savedProfile = await loadProfile();
        const savedStreak = await loadStreak();
        hydrateUser(
          savedUser,
          savedProfile,
          savedStreak ?? {
            currentStreak: 0,
            longestStreak: 0,
            lastClaimedDate: null,
            isTodayClaimed: false,
          },
        );
      } else {
        // First launch — generate guest session
        initGuest();
      }

      // 3. After user is resolved, bootstrap 3rd party SDKs
      const user = useUserStore.getState().user ?? createGuestUser();
      const userId = user.type === 'guest' ? user.guestId : user.id;

      setUserContext(userId, user.type === 'guest');
      initAnalytics(userId);
      await initRevenueCat(userId);

      setIsReady(true);
    }

    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isReady };
}
