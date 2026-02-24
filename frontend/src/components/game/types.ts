// ─── Level screen–specific types ─────────────────────────────────────────────

import type { Clue } from '@/domain/crossword/types';

export type WordFlash = 'idle' | 'correct' | 'wrong';

export interface GuessRecord {
  id: number;
  clue: Clue;
  word: string;
  correct: boolean;
}
