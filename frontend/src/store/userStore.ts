import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AppUser, UserProfile, StreakState } from '@/domain/user/types';
import { createGuestUser } from '@/domain/user/guest';
import { refreshStreakForNewDay, applyDailyCompletion } from '@/domain/streak/logic';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface UserState {
  user: AppUser | null;
  profile: UserProfile | null;
  streak: StreakState;
  isHydrated: boolean; // true after AsyncStorage restore is complete
}

// ─── Actions Shape ────────────────────────────────────────────────────────────

interface UserActions {
  /** Initialise a guest session (first launch) */
  initGuest: () => void;

  /** Called after loading from AsyncStorage */
  hydrateUser: (user: AppUser, profile: UserProfile | null, streak: StreakState) => void;

  /** TODO: Replace with real auth after backend integration */
  loginUser: (user: AppUser, profile: UserProfile) => void;

  /** Update profile fields (e.g., after earning coins) */
  updateProfile: (patch: Partial<UserProfile>) => void;

  /** Add coins to the user's balance */
  addCoins: (amount: number) => void;

  /** Deduct coins. Returns false if insufficient balance. */
  spendCoins: (amount: number) => boolean;

  /** Called on successful daily puzzle completion */
  claimDailyStreak: () => void;

  /** Called on app launch to refresh streak state for the new day */
  refreshStreak: () => void;

  /** Log out — reverts to guest */
  logout: () => void;
}

// ─── Default Streak ───────────────────────────────────────────────────────────

const defaultStreak: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastClaimedDate: null,
  isTodayClaimed: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUserStore = create<UserState & UserActions>()(
  subscribeWithSelector((set, get) => ({
    user: null,
    profile: null,
    streak: defaultStreak,
    isHydrated: false,

    initGuest: () => {
      const guest = createGuestUser();
      set({ user: guest, isHydrated: true });
    },

    hydrateUser: (user, profile, streak) => {
      const refreshedStreak = refreshStreakForNewDay(streak);
      set({ user, profile, streak: refreshedStreak, isHydrated: true });
    },

    loginUser: (user, profile) => {
      // TODO: Trigger backend guest-merge after login
      set({ user, profile });
    },

    updateProfile: (patch) => {
      const { profile } = get();
      if (!profile) return;
      set({ profile: { ...profile, ...patch } });
    },

    addCoins: (amount) => {
      const { profile } = get();
      if (!profile) return;
      set({ profile: { ...profile, coins: profile.coins + amount } });
    },

    spendCoins: (amount) => {
      const { profile } = get();
      if (!profile || profile.coins < amount) return false;
      set({ profile: { ...profile, coins: profile.coins - amount } });
      return true;
    },

    claimDailyStreak: () => {
      const { streak } = get();
      const newStreak = applyDailyCompletion(streak);
      set({ streak: newStreak });
    },

    refreshStreak: () => {
      const { streak } = get();
      set({ streak: refreshStreakForNewDay(streak) });
    },

    logout: () => {
      const guest = createGuestUser();
      set({
        user: guest,
        profile: null,
        streak: defaultStreak,
      });
    },
  })),
);

// ─── Selectors ─────────────────────────────────────────────────────────────────

export const selectUser = (s: UserState & UserActions) => s.user;
export const selectProfile = (s: UserState & UserActions) => s.profile;
export const selectStreak = (s: UserState & UserActions) => s.streak;
export const selectIsHydrated = (s: UserState & UserActions) => s.isHydrated;
export const selectCoins = (s: UserState & UserActions) => s.profile?.coins ?? 0;
export const selectIsPremium = (s: UserState & UserActions) => s.profile?.isPremium ?? false;
