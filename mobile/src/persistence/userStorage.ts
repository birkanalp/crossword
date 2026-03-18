import { storageGet, storageSet, storageRemove } from './storage';
import { STORAGE_KEYS } from './keys';
import type { AppUser, UserProfile, StreakState } from '@/domain/user/types';

// ─── User Persistence ─────────────────────────────────────────────────────────

export async function saveUser(user: AppUser): Promise<void> {
  await storageSet(STORAGE_KEYS.USER, user);
}

export async function loadUser(): Promise<AppUser | null> {
  return storageGet<AppUser>(STORAGE_KEYS.USER);
}

export async function clearUser(): Promise<void> {
  await storageRemove(STORAGE_KEYS.USER);
}

// ─── Profile Persistence ──────────────────────────────────────────────────────

export async function saveProfile(profile: UserProfile): Promise<void> {
  await storageSet(STORAGE_KEYS.USER_PROFILE, profile);
}

export async function loadProfile(): Promise<UserProfile | null> {
  return storageGet<UserProfile>(STORAGE_KEYS.USER_PROFILE);
}

// ─── Streak Persistence ───────────────────────────────────────────────────────

export async function saveStreak(streak: StreakState): Promise<void> {
  await storageSet(STORAGE_KEYS.STREAK, streak);
}

export async function loadStreak(): Promise<StreakState | null> {
  return storageGet<StreakState>(STORAGE_KEYS.STREAK);
}

// ─── Settings Persistence ─────────────────────────────────────────────────────

export async function saveSettings(settings: object): Promise<void> {
  await storageSet(STORAGE_KEYS.SETTINGS, settings);
}

export async function loadSettings(): Promise<object | null> {
  return storageGet<object>(STORAGE_KEYS.SETTINGS);
}
