import type { FilledCells, Clue } from '@/domain/crossword/types';
import { getCellsForClue, cellKey } from '@/domain/crossword/logic';

// ─── Score Submit Adapter ─────────────────────────────────────────────────────
// Contract: api.contract.json#/endpoints/submitScore/requestBody
//
// The backend expects:
//   answers: { "1A": "WORD", "3D": "OTHER", ... }
//
// The frontend stores:
//   filledCells: { "0-1": "W", "0-2": "O", ... }
//
// This module converts between the two formats.

export interface SubmitScoreBody {
  level_id: string;
  answers: Record<string, string>;
  time_spent: number;
  hints_used: number;
  mistakes: number;
}

/**
 * Converts frontend FilledCells into the answer map expected by submitScore.
 * Key format: `${number}${direction === 'across' ? 'A' : 'D'}` e.g. "1A", "3D"
 */
export function buildSubmitScoreBody(
  levelId: string,
  clues: Clue[],
  filledCells: FilledCells,
  timeSpent: number,
  hintsUsed: number,
  mistakes: number,
): SubmitScoreBody {
  const answers: Record<string, string> = {};

  for (const clue of clues) {
    const key = `${clue.number}${clue.direction === 'across' ? 'A' : 'D'}`;
    const cells = getCellsForClue(clue);
    const word = cells
      .map((pos) => filledCells[cellKey(pos.row, pos.col)] ?? '')
      .join('');
    answers[key] = word;
  }

  return {
    level_id: levelId,
    answers,
    time_spent: timeSpent,
    hints_used: hintsUsed,
    mistakes,
  };
}
