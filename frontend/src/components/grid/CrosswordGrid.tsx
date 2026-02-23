import React, { memo, useMemo } from 'react';
import Svg from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
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
}: CrosswordGridProps) {
  const cellSize = useMemo(() => {
    const raw = Math.floor(availableWidth / cols);
    return Math.min(Math.max(raw, APP_CONFIG.MIN_CELL_SIZE), APP_CONFIG.MAX_CELL_SIZE);
  }, [availableWidth, cols]);

  const svgWidth = cellSize * cols;
  const svgHeight = cellSize * rows;

  const handleCellPress = (position: GridPosition) => {
    onCellPress(position);
  };

  return (
    <View style={styles.container}>
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
                onPress={handleCellPress}
              />
            );
          }),
        )}
      </Svg>
    </View>
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
): GridCellRenderState[][] {
  // Pre-compute highlighted cells for the selected clue
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
      return {
        row: cell.row,
        col: cell.col,
        letter: filledCells[key] ?? '',
        cellNumber: cell.cellNumber,
        isBlocked: cell.isBlocked,
        isSelected: key === selectedKey,
        isHighlighted: highlightedKeys.has(key) && key !== selectedKey,
        isWrong: wrongCells.has(key),
        isCorrectWord: false, // TODO: set after word-correct animation
      };
    }),
  );
}
