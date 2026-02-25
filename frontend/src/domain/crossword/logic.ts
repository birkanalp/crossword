import type {
  CrosswordLevel,
  FilledCells,
  GridPosition,
  Clue,
  Direction,
  CellData,
} from './types';

// ─── Cell Helpers ─────────────────────────────────────────────────────────────

export function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export function parseCellKey(key: string): GridPosition {
  const [row, col] = key.split('-').map(Number);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return { row: row!, col: col! };
}

export function isBlocked(level: CrosswordLevel, row: number, col: number): boolean {
  return level.grid[row]?.[col]?.isBlocked ?? true;
}

// ─── Clue Resolution ─────────────────────────────────────────────────────────

/**
 * Given a position and direction, find the clue that owns that cell.
 */
export function findClueForCell(
  clues: Clue[],
  row: number,
  col: number,
  direction: Direction,
): Clue | null {
  return (
    clues.find((clue) => {
      if (clue.direction !== direction) return false;
      if (direction === 'across') {
        return clue.startRow === row && col >= clue.startCol && col < clue.startCol + clue.length;
      }
      // direction === 'down'
      return clue.startCol === col && row >= clue.startRow && row < clue.startRow + clue.length;
    }) ?? null
  );
}

/**
 * Returns all cells that belong to a given clue.
 */
export function getCellsForClue(clue: Clue): GridPosition[] {
  const cells: GridPosition[] = [];
  for (let i = 0; i < clue.length; i++) {
    if (clue.direction === 'across') {
      cells.push({ row: clue.startRow, col: clue.startCol + i });
    } else {
      cells.push({ row: clue.startRow + i, col: clue.startCol });
    }
  }
  return cells;
}

// ─── Input Navigation ─────────────────────────────────────────────────────────

/**
 * Returns the next empty cell position within a clue after the current position.
 * Returns null if no empty cell is found.
 */
export function nextEmptyCellInClue(
  clue: Clue,
  currentPos: GridPosition,
  filledCells: FilledCells,
): GridPosition | null {
  const cells = getCellsForClue(clue);
  const currentIndex = cells.findIndex(
    (c) => c.row === currentPos.row && c.col === currentPos.col,
  );
  if (currentIndex === -1) return null;

  for (let i = currentIndex + 1; i < cells.length; i++) {
    const cell = cells[i];
    if (cell && !filledCells[cellKey(cell.row, cell.col)]) {
      return cell;
    }
  }
  return null;
}

/**
 * Returns the previous cell in the clue (for backspace navigation).
 */
export function prevCellInClue(
  clue: Clue,
  currentPos: GridPosition,
): GridPosition | null {
  const cells = getCellsForClue(clue);
  const currentIndex = cells.findIndex(
    (c) => c.row === currentPos.row && c.col === currentPos.col,
  );
  if (currentIndex <= 0) return null;
  return cells[currentIndex - 1] ?? null;
}

// ─── Validation ───────────────────────────────────────────────────────────────
// NOTE: Client-side answer validation is only possible when `clue.answer` is
// present. The real backend NEVER sends answers (level.schema.json#/notes/serverOnly).
// These functions are no-ops / return safe defaults when answer is absent.
// Full validation is authoritative on the backend via submitScore.
// TODO (CR-004): Request a server-side "check" endpoint or encrypted answer field.

/**
 * Checks if a clue is fully and correctly filled.
 * Returns false (not complete) when answer is unavailable — safe default.
 */
export function isClueCorrect(clue: Clue, filledCells: FilledCells): boolean {
  if (!clue.answer) return false;
  const cells = getCellsForClue(clue);
  return cells.every((pos, index) => {
    const filled = filledCells[cellKey(pos.row, pos.col)];
    const expected = clue.answer![index];
    return filled?.toUpperCase() === expected?.toUpperCase();
  });
}

/**
 * Returns whether the entire puzzle is solved correctly client-side.
 * Without answers, checks that every letter cell is non-empty (optimistic).
 * Backend is always authoritative — this is only used for UI feedback.
 */
export function isPuzzleComplete(level: CrosswordLevel, filledCells: FilledCells): boolean {
  const hasAnswers = level.clues.some((c) => !!c.answer);
  if (hasAnswers) {
    return level.clues.every((clue) => isClueCorrect(clue, filledCells));
  }
  // Fallback: all non-blocked cells are filled
  return level.grid.every((row) =>
    row.every((cell) => cell.isBlocked || !!filledCells[cellKey(cell.row, cell.col)]),
  );
}

/**
 * Returns a set of cell keys that contain wrong letters.
 * Returns an empty set when answers are unavailable (no false positives).
 */
export function getWrongCells(level: CrosswordLevel, filledCells: FilledCells): Set<string> {
  const wrong = new Set<string>();

  for (const clue of level.clues) {
    if (!clue.answer) continue; // No answer available — skip silently
    const cells = getCellsForClue(clue);
    cells.forEach((pos, index) => {
      const key = cellKey(pos.row, pos.col);
      const filled = filledCells[key];
      const expected = clue.answer![index];
      if (filled && filled.toUpperCase() !== expected?.toUpperCase()) {
        wrong.add(key);
      }
    });
  }

  return wrong;
}

// ─── Direction Toggle ─────────────────────────────────────────────────────────

/**
 * When tapping an already-selected cell, toggle direction.
 * When tapping a new cell, keep the current direction unless only one is valid.
 */
export function resolveDirectionOnCellTap(
  level: CrosswordLevel,
  tappedPos: GridPosition,
  currentPos: GridPosition | null,
  currentDirection: Direction,
  clues: Clue[],
): Direction {
  const isSameCell =
    currentPos?.row === tappedPos.row && currentPos?.col === tappedPos.col;

  if (isSameCell) {
    const toggled: Direction = currentDirection === 'across' ? 'down' : 'across';
    const hasClue = findClueForCell(clues, tappedPos.row, tappedPos.col, toggled);
    return hasClue ? toggled : currentDirection;
  }

  // Check if the current direction has a clue at the new cell
  const hasCurrentDir = findClueForCell(clues, tappedPos.row, tappedPos.col, currentDirection);
  if (hasCurrentDir) return currentDirection;

  // Fall back to the other direction
  const other: Direction = currentDirection === 'across' ? 'down' : 'across';
  return other;
}

// ─── Grid Build Helper ────────────────────────────────────────────────────────

/**
 * Creates an empty FilledCells map from a level's non-blocked cells.
 * Used when starting a fresh level.
 */
export function buildEmptyFilledCells(level: CrosswordLevel): FilledCells {
  const result: FilledCells = {};
  for (const row of level.grid) {
    for (const cell of row) {
      if (!cell.isBlocked) {
        result[cellKey(cell.row, cell.col)] = '';
      }
    }
  }
  return result;
}

/**
 * Derives clue IDs that are fully filled from a FilledCells map.
 * Used when resuming from server progress: backend only stores cells from
 * correct validations, so any clue whose cells are all present was validated.
 */
export function deriveCorrectClueIds(clues: Clue[], filledCells: FilledCells): Set<string> {
  const ids = new Set<string>();
  for (const clue of clues) {
    const cells = getCellsForClue(clue);
    const allFilled = cells.every((pos) => {
      const letter = filledCells[cellKey(pos.row, pos.col)];
      return letter !== undefined && letter !== '';
    });
    if (allFilled) ids.add(clue.id);
  }
  return ids;
}

/**
 * Flattens a 2D grid array into a lookup map for O(1) access.
 */
export function buildCellMap(grid: CellData[][]): Map<string, CellData> {
  const map = new Map<string, CellData>();
  for (const row of grid) {
    for (const cell of row) {
      map.set(cellKey(cell.row, cell.col), cell);
    }
  }
  return map;
}
