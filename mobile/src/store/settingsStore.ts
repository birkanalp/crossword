import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface SettingsState {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  /** 'system' respects the OS dark/light mode preference */
  theme: 'light' | 'dark' | 'system';
  showTimer: boolean;
  showMistakeCount: boolean;
  isHydrated: boolean;
}

// ─── Actions Shape ────────────────────────────────────────────────────────────

interface SettingsActions {
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setTheme: (theme: SettingsState['theme']) => void;
  setShowTimer: (show: boolean) => void;
  setShowMistakeCount: (show: boolean) => void;
  hydrateSettings: (settings: Partial<SettingsState>) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  subscribeWithSelector((set) => ({
    soundEnabled: true,
    hapticsEnabled: true,
    theme: 'system',
    showTimer: true,
    showMistakeCount: false,
    isHydrated: false,

    setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
    setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
    setTheme: (theme) => set({ theme }),
    setShowTimer: (show) => set({ showTimer: show }),
    setShowMistakeCount: (show) => set({ showMistakeCount: show }),

    hydrateSettings: (settings) =>
      set({ ...settings, isHydrated: true }),
  })),
);

// ─── Selectors ─────────────────────────────────────────────────────────────────

export const selectSoundEnabled = (s: SettingsState & SettingsActions) => s.soundEnabled;
export const selectHapticsEnabled = (s: SettingsState & SettingsActions) => s.hapticsEnabled;
export const selectTheme = (s: SettingsState & SettingsActions) => s.theme;
