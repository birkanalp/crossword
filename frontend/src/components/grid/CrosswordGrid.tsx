import React, { memo, useMemo } from 'react';
import Svg from 'react-native-svg';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { GridCell } from './GridCell';
import type { CrosswordGridProps, GridCellRenderState } from './types';
import { APP_CONFIG } from '@/constants/config';
import type { GridPosition } from '@/domain/crossword/types';

// ─── CrosswordGrid ────────────────────────────────────────────────────────────
// Renders the full crossword grid as an SVG.
// Cell size is computed to fill availableWidth while respecting min/max bounds.
// Only changed cells re-render due to GridCell memoisation.

function CrosswordGridComponent({
  rows,
  cols,
  cellStates,
  onCellPress,
  availableWidth,
  availableHeight,
  animatedStyle,
}: CrosswordGridProps) {
  const cellSize = useMemo(() => {
    // Fit horizontally
    const byWidth = Math.floor(availableWidth / cols);
    // Fit vertically if a height constraint is provided
    const byHeight = availableHeight != null ? Math.floor(availableHeight / rows) : byWidth;
    const raw = Math.min(byWidth, byHeight);
    return Math.min(Math.max(raw, APP_CONFIG.MIN_CELL_SIZE), APP_CONFIG.MAX_CELL_SIZE);
  }, [availableWidth, availableHeight, cols, rows]);

  const svgWidth = cellSize * cols;
  const svgHeight = cellSize * rows;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Svg width={svgWidth} height={svgHeight}>
        {cellStates.map((rowCells) =>
          rowCells.map((cell) => {
            const x = cell.col * cellSize;
            const y = cell.row * cellSize;
            return (
              <GridCell
                key={`${cell.row}-${cell.col}`}
                state={cell}
                cellSize={cellSize}
                x={x}
                y={y}
                onPress={onCellPress}
              />
            );
          }),
        )}
      </Svg>
    </Animated.View>
  );
}

export const CrosswordGrid = memo(CrosswordGridComponent);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});

// ─── Cell State Builder ───────────────────────────────────────────────────────
// Pure function — build render state from domain data and game store slices.
// Call this in the Level screen and pass cellStates down.

import type { CrosswordLevel, FilledCells, Clue } from '@/domain/crossword/types';
import { cellKey, getCellsForClue } from '@/domain/crossword/logic';

export function buildCellStates(
  level: CrosswordLevel,
  filledCells: FilledCells,
  selectedCell: GridPosition | null,
  selectedClue: Clue | null,
  wrongCells: Set<string>,
  flashCells: Set<string> = new Set(),
  flashType: 'correct' | 'wrong' | 'idle' = 'idle',
): GridCellRenderState[][] {
  const highlightedKeys = new Set<string>();
  if (selectedClue) {
    for (const pos of getCellsForClue(selectedClue)) {
      highlightedKeys.add(cellKey(pos.row, pos.col));
    }
  }

  const selectedKey = selectedCell ? cellKey(selectedCell.row, selectedCell.col) : null;

  return level.grid.map((row) =>
    row.map((cell) => {
      const key = cellKey(cell.row, cell.col);
      const isFlashing = flashCells.has(key);
      return {
        row: cell.row,
        col: cell.col,
        letter: filledCells[key] ?? '',
        cellNumber: cell.cellNumber,
        isBlocked: cell.isBlocked,
        isSelected: key === selectedKey,
        isHighlighted: highlightedKeys.has(key) && key !== selectedKey,
        isWrong: wrongCells.has(key),
        isCorrectWord: false,
        isFlashCorrect: isFlashing && flashType === 'correct',
        isFlashWrong: isFlashing && flashType === 'wrong',
      };
    }),
  );
}
