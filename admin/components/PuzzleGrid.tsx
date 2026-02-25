'use client';

import { useMemo, memo } from 'react';
import type { AdminLevel } from '@/lib/api';
import {
  buildGridFromLevel,
  buildCluesFromLevel,
  cellKey,
  getCellsForClue,
  type ClueForDisplay,
} from '@/lib/puzzle-utils';

interface PuzzleGridProps {
  level: AdminLevel;
  filledCells: Record<string, string>;
  showAnswers: boolean;
  selectedClueId: string | null;
  cellSize?: number;
}

function PuzzleGridComponent({
  level,
  filledCells,
  showAnswers,
  selectedClueId,
  cellSize = 36,
}: PuzzleGridProps) {
  const grid = useMemo(() => buildGridFromLevel(level), [level]);
  const clues = useMemo(() => buildCluesFromLevel(level), [level]);

  const gj = level?.grid_json;
  const rows = gj?.rows ?? 0;
  const cols = gj?.cols ?? 0;

  if (!rows || !cols || grid.length === 0) {
    return (
      <div style={{ padding: 24, background: '#1a1a22', borderRadius: 8, color: '#a0a0b0' }}>
        Grid verisi yok veya geçersiz
      </div>
    );
  }

  const highlightedKeys = useMemo(() => {
    const set = new Set<string>();
    const clue = clues.find((c) => c.id === selectedClueId);
    if (clue) {
      for (const pos of getCellsForClue(clue)) {
        set.add(cellKey(pos.row, pos.col));
      }
    }
    return set;
  }, [clues, selectedClueId]);

  return (
    <div
      style={{
        display: 'inline-grid',
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
        gap: 1,
        background: '#2a2a35',
        padding: 4,
        borderRadius: 8,
      }}
    >
      {grid.map((row) =>
        row.map((cell) => {
          const key = cellKey(cell.row, cell.col);
          const letter = showAnswers
            ? filledCells[key] || ''
            : filledCells[key] || '';
          const isHighlighted = highlightedKeys.has(key);

          if (cell.type === 'black') {
            return (
              <div
                key={key}
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: '#1a1a22',
                }}
              />
            );
          }

          return (
            <div
              key={key}
              style={{
                width: cellSize,
                height: cellSize,
                background: isHighlighted ? '#2a3a4a' : '#252530',
                border: '1px solid #3a3a45',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                fontSize: cellSize * 0.5,
                fontWeight: 600,
              }}
            >
              {cell.number != null && (
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: 4,
                    fontSize: 10,
                    color: '#707080',
                  }}
                >
                  {cell.number}
                </span>
              )}
              <span style={{ color: '#e8e8ed' }}>{letter}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

const PuzzleGrid = memo(PuzzleGridComponent);
export default PuzzleGrid;
export { type ClueForDisplay };
