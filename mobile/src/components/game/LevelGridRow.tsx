// ─── Level grid row (crossword grid only) ─────────────────────────────────────

import React from 'react';
import { View } from 'react-native';
import type { GridCellRenderState } from '@/components/grid/types';
import { CrosswordGrid } from '@/components/grid/CrosswordGrid';
import type { LevelScreenStyles } from './levelScreen.styles';

interface LevelGridRowProps {
  level: { rows: number; cols: number };
  cellStates: GridCellRenderState[][];
  onCellPress: (position: { row: number; col: number }) => void;
  styles: LevelScreenStyles;
  availableWidth: number;
  availableHeight: number;
  animatedStyle: { transform: { translateX: number }[] };
}

export function LevelGridRow({
  level,
  cellStates,
  onCellPress,
  styles,
  availableWidth,
  availableHeight,
  animatedStyle,
}: LevelGridRowProps) {
  return (
    <View style={styles.gridRow}>
      <View style={styles.gridContainer}>
        {cellStates.length > 0 && (
          <CrosswordGrid
            rows={level.rows}
            cols={level.cols}
            cellStates={cellStates}
            onCellPress={onCellPress}
            availableWidth={availableWidth}
            availableHeight={availableHeight}
            animatedStyle={animatedStyle}
          />
        )}
      </View>
    </View>
  );
}
