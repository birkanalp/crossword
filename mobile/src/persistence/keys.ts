// ─── AsyncStorage Key Registry ────────────────────────────────────────────────
// All keys are namespaced under 'bulmaca/' to avoid collisions.

export const STORAGE_KEYS = {
  USER: 'bulmaca/user',
  USER_PROFILE: 'bulmaca/user_profile',
  STREAK: 'bulmaca/streak',
  SETTINGS: 'bulmaca/settings',

  /** Returns the key for a specific level's in-progress state */
  levelProgress: (levelId: string) => `bulmaca/progress/${levelId}`,

  /** Returns the key for a list of completed level IDs */
  COMPLETED_LEVELS: 'bulmaca/completed_levels',

  /** Date string of last-played daily puzzle */
  LAST_DAILY_DATE: 'bulmaca/last_daily_date',
} as const;
