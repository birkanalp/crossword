// ─── App Config ───────────────────────────────────────────────────────────────

export const APP_CONFIG = {
  /** Max coins a user can hold */
  MAX_COINS: 99_999,

  /** How many levels to show per page in the level list */
  LEVELS_PAGE_SIZE: 20,

  /** Min grid cell size in dp */
  MIN_CELL_SIZE: 30,

  /** Max grid cell size in dp */
  MAX_CELL_SIZE: 52,

  /** Fraction of screen width the grid can occupy */
  GRID_WIDTH_FRACTION: 0.92,

  /** Cell number font size relative to cell size */
  CELL_NUMBER_SIZE_RATIO: 0.28,

  /** Cell letter font size relative to cell size */
  CELL_LETTER_SIZE_RATIO: 0.5,

  /** Border radius for cells */
  CELL_BORDER_RADIUS: 3,

  /** Border width for grid cells */
  CELL_BORDER_WIDTH: 1,
} as const;
