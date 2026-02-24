import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CrosswordLevel, FilledCells, Clue, Direction } from '@/domain/crossword/types';
import type { GridPosition } from '@/domain/crossword/types';
import {
  buildEmptyFilledCells,
  findClueForCell,
  resolveDirectionOnCellTap,
  isPuzzleComplete,
  getWrongCells,
  nextEmptyCellInClue,
  prevCellInClue,
  cellKey,
  getCellsForClue,
} from '@/domain/crossword/logic';
import { calculateScore } from '@/domain/crossword/scoring';
import type { ScoreBreakdown } from '@/domain/crossword/types';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface GameState {
  // Current level
  currentLevel: CrosswordLevel | null;

  // Selection
  selectedCell: GridPosition | null;
  selectedClue: Clue | null;
  direction: Direction;

  // Player progress
  filledCells: FilledCells;
  elapsedTime: number; // seconds
  hintsUsed: number;
  mistakes: number;
  isCompleted: boolean;
  scoreBreakdown: ScoreBreakdown | null;

  // Runtime UI state
  wrongCells: Set<string>;
  correctClueIds: Set<string>;
  isTimerRunning: boolean;
}

// ─── Actions Shape ────────────────────────────────────────────────────────────

interface GameActions {
  /** Load a level and optionally restore saved progress */
  loadLevel: (level: CrosswordLevel, savedCells?: FilledCells, savedTime?: number) => void;

  /** Handle a cell tap — updates selection and direction */
  tapCell: (row: number, col: number) => void;

  /** Enter a letter into the selected cell */
  enterLetter: (letter: string) => void;

  /** Delete the letter in the selected cell (backspace) */
  deleteLetter: () => void;

  /**
   * Clear the given clue's grid cells (called on wrong answer).
   * Respects cells shared with other committed clues.
   */
  clearCluePreview: (clue: Clue) => void;

  /**
   * Write an array of letters into the given clue's cells all at once.
   * Marks the clue as correctly answered in correctClueIds.
   */
  commitWord: (clue: Clue, letters: string[]) => boolean;

  /** Directly select a clue from the clue list */
  selectClue: (clue: Clue) => void;

  /**
   * Move selection to the next clue that hasn't been correctly answered yet.
   * Order: across clues by number, then down clues by number.
   */
  advanceToNextClue: () => void;

  /** Apply a "reveal letter" hint to a specific cell */
  revealLetter: (row: number, col: number) => void;

  /** Apply a "reveal word" hint to the selected clue */
  revealWord: () => void;

  /** Apply a "clear wrong letters" hint */
  clearWrongLetters: () => void;

  /** Tick the timer by 1 second */
  tickTimer: () => void;

  /** Pause / resume the timer */
  setTimerRunning: (running: boolean) => void;

  /** Restore elapsed time (from saved session) */
  restoreElapsedTime: (seconds: number) => void;

  /** Reset all game state (called on level exit) */
  resetGame: () => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: GameState = {
  currentLevel: null,
  selectedCell: null,
  selectedClue: null,
  direction: 'across',
  filledCells: {},
  elapsedTime: 0,
  hintsUsed: 0,
  mistakes: 0,
  isCompleted: false,
  scoreBreakdown: null,
  wrongCells: new Set(),
  correctClueIds: new Set(),
  isTimerRunning: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameState & GameActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    loadLevel: (level, savedCells, savedTime) => {
      const filledCells = savedCells ?? buildEmptyFilledCells(level);
      const firstClue = level.clues.find((c) => c.direction === 'across') ?? level.clues[0] ?? null;

      set({
        currentLevel: level,
        filledCells,
        elapsedTime: savedTime ?? 0,
        hintsUsed: 0,
        mistakes: 0,
        isCompleted: false,
        scoreBreakdown: null,
        wrongCells: new Set(),
        correctClueIds: new Set(),
        selectedClue: firstClue,
        selectedCell: firstClue
          ? { row: firstClue.startRow, col: firstClue.startCol }
          : null,
        direction: firstClue?.direction ?? 'across',
        isTimerRunning: true,
      });
    },

    tapCell: (row, col) => {
      const { currentLevel, selectedCell, direction, filledCells } = get();
      if (!currentLevel) return;

      const newDirection = resolveDirectionOnCellTap(
        currentLevel,
        { row, col },
        selectedCell,
        direction,
        currentLevel.clues,
      );

      const clue = findClueForCell(currentLevel.clues, row, col, newDirection);

      set({
        selectedCell: { row, col },
        direction: newDirection,
        selectedClue: clue,
      });
    },

    enterLetter: (letter) => {
      const { currentLevel, selectedCell, selectedClue, filledCells } = get();
      if (!currentLevel || !selectedCell || !selectedClue) return;

      const key = cellKey(selectedCell.row, selectedCell.col);
      const upperLetter = letter.toUpperCase();

      const newFilledCells = { ...filledCells, [key]: upperLetter };

      // Check if the entered letter is wrong to count mistakes.
      // answer is optional — backend never sends it (level.schema.json#/notes/serverOnly).
      // When absent, we cannot detect mistakes client-side (CR-004).
      const clueLetterIndex =
        selectedClue.direction === 'across'
          ? selectedCell.col - selectedClue.startCol
          : selectedCell.row - selectedClue.startRow;
      const correctLetter = selectedClue.answer?.[clueLetterIndex]?.toUpperCase();
      const isMistake = correctLetter !== undefined && upperLetter !== correctLetter;

      // Update wrong cells set
      const newWrongCells = new Set(get().wrongCells);
      if (isMistake) {
        newWrongCells.add(key);
      } else {
        newWrongCells.delete(key);
      }

      // Advance to next cell
      const nextPos = nextEmptyCellInClue(selectedClue, selectedCell, newFilledCells);

      // Check completion
      const isCompleted = isPuzzleComplete(currentLevel, newFilledCells);
      const scoreBreakdown = isCompleted
        ? calculateScore(get().elapsedTime, get().hintsUsed)
        : null;

      set((state) => ({
        filledCells: newFilledCells,
        mistakes: isMistake ? state.mistakes + 1 : state.mistakes,
        wrongCells: newWrongCells,
        selectedCell: nextPos ?? selectedCell,
        isCompleted,
        scoreBreakdown,
        isTimerRunning: !isCompleted,
      }));
    },

    deleteLetter: () => {
      const { selectedCell, selectedClue, filledCells } = get();
      if (!selectedCell || !selectedClue) return;

      const key = cellKey(selectedCell.row, selectedCell.col);

      if (filledCells[key]) {
        // Clear current cell
        const newFilledCells = { ...filledCells, [key]: '' };
        const newWrongCells = new Set(get().wrongCells);
        newWrongCells.delete(key);
        set({ filledCells: newFilledCells, wrongCells: newWrongCells });
      } else {
        // Move back and clear
        const prevPos = prevCellInClue(selectedClue, selectedCell);
        if (prevPos) {
          const prevKey = cellKey(prevPos.row, prevPos.col);
          const newFilledCells = { ...filledCells, [prevKey]: '' };
          const newWrongCells = new Set(get().wrongCells);
          newWrongCells.delete(prevKey);
          set({
            selectedCell: prevPos,
            filledCells: newFilledCells,
            wrongCells: newWrongCells,
          });
        }
      }
    },

    clearCluePreview: (clue) => {
      const { currentLevel, filledCells, correctClueIds } = get();
      if (!currentLevel) return;

      const cells = getCellsForClue(clue);
      const newFilledCells = { ...filledCells };
      const newWrongCells = new Set(get().wrongCells);
      cells.forEach((pos) => {
        const key = cellKey(pos.row, pos.col);
        // Don't erase a cell already locked by another committed clue.
        const lockedByOther = currentLevel.clues.some(
          (c) =>
            c.id !== clue.id &&
            correctClueIds.has(c.id) &&
            getCellsForClue(c).some((cp) => cp.row === pos.row && cp.col === pos.col),
        );
        if (!lockedByOther) {
          newFilledCells[key] = '';
          newWrongCells.delete(key);
        }
      });
      set({ filledCells: newFilledCells, wrongCells: newWrongCells });
    },

    commitWord: (clue, letters) => {
      const { currentLevel, filledCells } = get();
      if (!currentLevel) return false;

      const cells = getCellsForClue(clue);
      const newFilledCells = { ...filledCells };
      const newWrongCells = new Set(get().wrongCells);
      let hasMistake = false;

      cells.forEach((pos, index) => {
        const letter = letters[index];
        if (!letter) return;
        const key = cellKey(pos.row, pos.col);
        const upperLetter = letter.toUpperCase();
        newFilledCells[key] = upperLetter;

        const correctLetter = clue.answer?.[index]?.toUpperCase();
        if (correctLetter !== undefined && upperLetter !== correctLetter) {
          newWrongCells.add(key);
          hasMistake = true;
        } else {
          newWrongCells.delete(key);
        }
      });

      const isCompleted = isPuzzleComplete(currentLevel, newFilledCells);
      const scoreBreakdown = isCompleted
        ? calculateScore(get().elapsedTime, get().hintsUsed)
        : null;

      const newCorrectClueIds = new Set(get().correctClueIds);
      newCorrectClueIds.add(clue.id);

      set((state) => ({
        filledCells: newFilledCells,
        wrongCells: newWrongCells,
        mistakes: hasMistake ? state.mistakes + 1 : state.mistakes,
        correctClueIds: newCorrectClueIds,
        isCompleted,
        scoreBreakdown,
        isTimerRunning: !isCompleted,
      }));

      return hasMistake;
    },

    selectClue: (clue) => {
      set({
        selectedClue: clue,
        direction: clue.direction,
        selectedCell: { row: clue.startRow, col: clue.startCol },
      });
    },

    advanceToNextClue: () => {
      const { currentLevel, selectedClue, correctClueIds } = get();
      if (!currentLevel) return;

      // Natural order: across sorted by number, then down sorted by number
      const ordered = [
        ...currentLevel.clues.filter((c) => c.direction === 'across').sort((a, b) => a.number - b.number),
        ...currentLevel.clues.filter((c) => c.direction === 'down').sort((a, b) => a.number - b.number),
      ];

      const unanswered = ordered.filter((c) => !correctClueIds.has(c.id));
      if (unanswered.length === 0) return; // puzzle complete

      // Find the next unanswered clue after the current one
      const currentIndex = ordered.findIndex((c) => c.id === selectedClue?.id);
      const next =
        unanswered.find((c) => ordered.indexOf(c) > currentIndex) ?? unanswered[0];

      if (next) {
        set({
          selectedClue: next,
          direction: next.direction,
          selectedCell: { row: next.startRow, col: next.startCol },
        });
      }
    },

    revealLetter: (row, col) => {
      const { currentLevel, filledCells } = get();
      if (!currentLevel) return;

      // Find the correct letter from any clue that covers this cell
      let correctLetter: string | null = null;
      for (const clue of currentLevel.clues) {
        const cells = getCellsForClue(clue);
        const idx = cells.findIndex((c) => c.row === row && c.col === col);
        if (idx !== -1) {
          correctLetter = clue.answer?.[idx]?.toUpperCase() ?? null;
          break;
        }
      }

      if (!correctLetter) return;

      const key = cellKey(row, col);
      const newFilledCells = { ...filledCells, [key]: correctLetter };
      const newWrongCells = new Set(get().wrongCells);
      newWrongCells.delete(key);

      const isCompleted = isPuzzleComplete(currentLevel, newFilledCells);
      const scoreBreakdown = isCompleted
        ? calculateScore(get().elapsedTime, get().hintsUsed + 1)
        : null;

      set((state) => ({
        filledCells: newFilledCells,
        wrongCells: newWrongCells,
        hintsUsed: state.hintsUsed + 1,
        isCompleted,
        scoreBreakdown,
        isTimerRunning: !isCompleted,
      }));
    },

    revealWord: () => {
      const { currentLevel, selectedClue, filledCells } = get();
      if (!currentLevel || !selectedClue) return;

      const cells = getCellsForClue(selectedClue);
      const newFilledCells = { ...filledCells };
      const newWrongCells = new Set(get().wrongCells);

      cells.forEach((pos, index) => {
        const key = cellKey(pos.row, pos.col);
        const letter = selectedClue.answer?.[index]?.toUpperCase() ?? '';
        newFilledCells[key] = letter;
        newWrongCells.delete(key);
      });

      const isCompleted = isPuzzleComplete(currentLevel, newFilledCells);
      const scoreBreakdown = isCompleted
        ? calculateScore(get().elapsedTime, get().hintsUsed + 1)
        : null;

      set((state) => ({
        filledCells: newFilledCells,
        wrongCells: newWrongCells,
        hintsUsed: state.hintsUsed + 1,
        isCompleted,
        scoreBreakdown,
        isTimerRunning: !isCompleted,
      }));
    },

    clearWrongLetters: () => {
      const { filledCells, wrongCells } = get();
      if (wrongCells.size === 0) return;

      const newFilledCells = { ...filledCells };
      wrongCells.forEach((key) => {
        newFilledCells[key] = '';
      });

      set((state) => ({
        filledCells: newFilledCells,
        wrongCells: new Set(),
        hintsUsed: state.hintsUsed + 1,
      }));
    },

    tickTimer: () => {
      if (!get().isTimerRunning) return;
      set((state) => ({ elapsedTime: state.elapsedTime + 1 }));
    },

    setTimerRunning: (running) => set({ isTimerRunning: running }),

    restoreElapsedTime: (seconds) => set({ elapsedTime: seconds }),

    resetGame: () => set(initialState),
  })),
);

// ─── Selectors ─────────────────────────────────────────────────────────────────
// Memoized selectors reduce re-renders — import and use these in components.

export const selectCurrentLevel = (s: GameState & GameActions) => s.currentLevel;
export const selectFilledCells = (s: GameState & GameActions) => s.filledCells;
export const selectSelectedCell = (s: GameState & GameActions) => s.selectedCell;
export const selectSelectedClue = (s: GameState & GameActions) => s.selectedClue;
export const selectDirection = (s: GameState & GameActions) => s.direction;
export const selectElapsedTime = (s: GameState & GameActions) => s.elapsedTime;
export const selectIsCompleted = (s: GameState & GameActions) => s.isCompleted;
export const selectScoreBreakdown = (s: GameState & GameActions) => s.scoreBreakdown;
export const selectHintsUsed = (s: GameState & GameActions) => s.hintsUsed;
export const selectWrongCells = (s: GameState & GameActions) => s.wrongCells;
export const selectCorrectClueIds = (s: GameState & GameActions) => s.correctClueIds;
