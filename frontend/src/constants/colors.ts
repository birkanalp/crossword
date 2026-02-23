// ─── Color Palette ────────────────────────────────────────────────────────────

export const Colors = {
  // Brand
  primary: '#6C63FF',
  primaryDark: '#4A42D6',
  accent: '#FF6584',

  // Backgrounds
  bgDark: '#1a1a2e',
  bgDarkSecondary: '#16213e',
  bgLight: '#F8F9FA',
  bgLightSecondary: '#FFFFFF',

  // Grid
  cellBackground: '#FFFFFF',
  cellBackgroundDark: '#2d2d44',
  cellBlocked: '#1a1a2e',
  cellBlockedDark: '#0d0d1a',
  cellSelected: '#C5BEFF',
  cellSelectedDark: '#4A42D6',
  cellHighlighted: '#E8E6FF',
  cellHighlightedDark: '#2d2a5e',
  cellCorrect: '#A8E6CF',
  cellWrong: '#FF8B94',
  cellBorder: '#D0D0E0',
  cellBorderDark: '#3a3a5c',

  // Text
  textPrimary: '#1a1a2e',
  textSecondary: '#6B7280',
  textOnDark: '#FFFFFF',
  textOnDarkSecondary: '#B0B0C8',
  textOnPrimary: '#FFFFFF',

  // Clue panel
  clueActive: '#6C63FF',
  clueActiveBg: '#EEF0FF',
  clueActiveBgDark: '#2a2756',

  // Status
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',

  // Coin
  coin: '#FFD700',
  coinShadow: '#B8860B',
} as const;

// ─── Semantic Color Maps ──────────────────────────────────────────────────────

export type ColorScheme = 'light' | 'dark';

export function getCellColors(scheme: ColorScheme) {
  return {
    background: scheme === 'dark' ? Colors.cellBackgroundDark : Colors.cellBackground,
    blocked: scheme === 'dark' ? Colors.cellBlockedDark : Colors.cellBlocked,
    selected: scheme === 'dark' ? Colors.cellSelectedDark : Colors.cellSelected,
    highlighted: scheme === 'dark' ? Colors.cellHighlightedDark : Colors.cellHighlighted,
    border: scheme === 'dark' ? Colors.cellBorderDark : Colors.cellBorder,
    text: scheme === 'dark' ? Colors.textOnDark : Colors.textPrimary,
  };
}
