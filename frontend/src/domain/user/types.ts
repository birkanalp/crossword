// ─── User Types ───────────────────────────────────────────────────────────────

export type AuthState = 'guest' | 'authenticated';

export interface GuestUser {
  type: 'guest';
  guestId: string;
  createdAt: string;
}

export interface AuthenticatedUser {
  type: 'authenticated';
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  guestId: string | null; // preserved from guest session for merge
  createdAt: string;
}

export type AppUser = GuestUser | AuthenticatedUser;

// ─── Profile Types ────────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  totalScore: number;
  levelsCompleted: number;
  coins: number;
  streak: number;
  lastActiveDate: string; // YYYY-MM-DD
  isPremium: boolean;
  rank: number | null;
  /** Set after the user completes ProfileSetupModal (leaderboard display name) */
  username?: string;
  /** Hex colour chosen in ProfileSetupModal, e.g. "#6366F1" */
  avatarColor?: string;
}

// ─── Streak Types ─────────────────────────────────────────────────────────────

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastClaimedDate: string | null; // YYYY-MM-DD
  isTodayClaimed: boolean;
}
