import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
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
  isFlashCorrect: boolean;
  isFlashWrong: boolean;
}

export interface CrosswordGridProps {
  rows: number;
  cols: number;
  /** Cells from domain layer mapped to render state */
  cellStates: GridCellRenderState[][];
  /** Called when a non-blocked cell is tapped */
  onCellPress: (position: GridPosition) => void;
  /** Available width in dp — grid scales to fit horizontally */
  availableWidth: number;
  /**
   * Optional height budget in dp — when provided, cell size is also
   * constrained so the full grid fits vertically without scrolling.
   */
  availableHeight?: number;
  /** Optional reanimated style for shake/bounce on the grid wrapper */
  animatedStyle?: AnimatedStyle<ViewStyle>;
}

export interface GridCellProps {
  state: GridCellRenderState;
  cellSize: number;
  x: number;
  y: number;
  onPress: (position: GridPosition) => void;
}
