import React, { memo } from 'react';
import { G, Rect, Text } from 'react-native-svg';
import type { GridCellProps } from './types';
import { Colors } from '@/constants/colors';
import { APP_CONFIG } from '@/constants/config';
import { useColorScheme } from 'react-native';

// ─── GridCell ─────────────────────────────────────────────────────────────────
// Renders a single crossword cell via SVG primitives.
// Memoised so only cells whose state changes trigger a re-render.

function GridCellComponent({ state, cellSize, x, y, onPress }: GridCellProps) {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';

  if (state.isBlocked) {
    return (
      <Rect
        x={x}
        y={y}
        width={cellSize}
        height={cellSize}
        fill={isDark ? Colors.cellBlockedDark : Colors.cellBlocked}
      />
    );
  }

  // ─── Background colour by state ─────────────────────────────────────────────
  let fill: string;
  if (state.isSelected) {
    fill = isDark ? Colors.cellSelectedDark : Colors.cellSelected;
  } else if (state.isWrong) {
    fill = Colors.cellWrong;
  } else if (state.isCorrectWord) {
    fill = Colors.cellCorrect;
  } else if (state.isHighlighted) {
    fill = isDark ? Colors.cellHighlightedDark : Colors.cellHighlighted;
  } else {
    fill = isDark ? Colors.cellBackgroundDark : Colors.cellBackground;
  }

  const borderColor = isDark ? Colors.cellBorderDark : Colors.cellBorder;
  const letterColor = isDark ? Colors.textOnDark : Colors.textPrimary;
  const numberColor = isDark ? Colors.textOnDarkSecondary : Colors.textSecondary;

  const numberFontSize = Math.floor(cellSize * APP_CONFIG.CELL_NUMBER_SIZE_RATIO);
  const letterFontSize = Math.floor(cellSize * APP_CONFIG.CELL_LETTER_SIZE_RATIO);

  const handlePress = () => {
    if (!state.isBlocked) {
      onPress({ row: state.row, col: state.col });
    }
  };

  return (
    <G onPress={handlePress}>
      {/* Cell background */}
      <Rect
        x={x}
        y={y}
        width={cellSize}
        height={cellSize}
        fill={fill}
        stroke={borderColor}
        strokeWidth={APP_CONFIG.CELL_BORDER_WIDTH}
        rx={APP_CONFIG.CELL_BORDER_RADIUS}
        ry={APP_CONFIG.CELL_BORDER_RADIUS}
      />

      {/* Cell number (top-left) */}
      {state.cellNumber !== null && (
        <Text
          x={x + 2}
          y={y + numberFontSize + 1}
          fontSize={numberFontSize}
          fill={numberColor}
          fontWeight="500"
        >
          {state.cellNumber}
        </Text>
      )}

      {/* Filled letter (centred) */}
      {state.letter.length > 0 && (
        <Text
          x={x + cellSize / 2}
          y={y + cellSize / 2 + letterFontSize * 0.36}
          fontSize={letterFontSize}
          fill={letterColor}
          textAnchor="middle"
          fontWeight="700"
        >
          {state.letter}
        </Text>
      )}
    </G>
  );
}

export const GridCell = memo(GridCellComponent);
