/**
 * Utilities for admin puzzle display — adapts AdminLevel to grid/clue structures
 */

import type { AdminLevel, AdminClue } from '@/lib/api';

export interface GridCell {
  row: number;
  col: number;
  type: 'letter' | 'black';
  number?: number;
}

export interface ClueForDisplay {
  id: string;
  number: number;
  direction: 'across' | 'down';
  text: string;
  startRow: number;
  startCol: number;
  length: number;
  answer: string;
  hint: string;
}

export function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export function getCellsForClue(clue: ClueForDisplay): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  for (let i = 0; i < clue.length; i++) {
    if (clue.direction === 'across') {
      cells.push({ row: clue.startRow, col: clue.startCol + i });
    } else {
      cells.push({ row: clue.startRow + i, col: clue.startCol });
    }
  }
  return cells;
}

export function buildGridFromLevel(level: AdminLevel): GridCell[][] {
  const gj = level?.grid_json;
  if (!gj?.rows || !gj?.cols) return [];
  const { rows, cols, cells } = gj;
  const grid: GridCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r,
      col: c,
      type: 'black' as const,
    }))
  );
  for (const cell of cells) {
    if (cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols) {
      grid[cell.row][cell.col] = {
        row: cell.row,
        col: cell.col,
        type: cell.type,
        number: cell.number,
      };
    }
  }
  return grid;
}

export function buildCluesFromLevel(level: AdminLevel): ClueForDisplay[] {
  const clues: ClueForDisplay[] = [];
  const cj = level?.clues_json;
  if (!cj) return [];
  const add = (c: AdminClue, dir: 'across' | 'down') => {
    const start = c?.start ?? { row: 0, col: 0 };
    clues.push({
      id: `${c.number}${dir === 'across' ? 'A' : 'D'}`,
      number: c.number,
      direction: dir,
      text: c.clue ?? '',
      startRow: start.row,
      startCol: start.col,
      length: c.answer_length ?? 0,
      answer: c.answer ?? '',
      hint: c.hint ?? '',
    });
  };
  for (const c of cj.across ?? []) add(c, 'across');
  for (const c of cj.down ?? []) add(c, 'down');
  return clues;
}
