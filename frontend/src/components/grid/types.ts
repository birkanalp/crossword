import type { GridPosition } from '@/domain/crossword/types';

// ─── Grid Renderer Props ──────────────────────────────────────────────────────

export interface GridCellRenderState {
  row: number;
  col: number;
  letter: string;
  cellNumber: number | null;
  isBlocked: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isWrong: boolean;
  isCorrectWord: boolean;
}

export interface CrosswordGridProps {
  rows: number;
  cols: number;
  /** Cells from domain layer mapped to render state */
  cellStates: GridCellRenderState[][];
  /** Called when a non-blocked cell is tapped */
  onCellPress: (position: GridPosition) => void;
  /** Available width in dp — grid scales to fit */
  availableWidth: number;
}

export interface GridCellProps {
  state: GridCellRenderState;
  cellSize: number;
  x: number;
  y: number;
  onPress: (position: GridPosition) => void;
}
