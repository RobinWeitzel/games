/**
 * Everything Sudoku persists. Keep ALL storage declarations of a game in this file so they
 * are easy to review; the storage contract test (src/core/storage/contract.test.ts) loads
 * every games/<id>/storage.ts and fails if a key or version changes unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { cacheKey, defineCache, defineStore, gameKey } from '../../core/storage';
import { createGameSettings } from '../../core/settings';
import { createGameStats } from '../../core/stats';
import type { SudokuGame } from './state';

export const GAME_ID = 'sudoku';

/** games/game/sudoku/settings */
export const sudokuSettings = createGameSettings(
  GAME_ID,
  {
    /** End the game after 3 mistakes. */
    mistakeLimit: true,
    /** Highlight all cells with the selected number. */
    highlightSame: true,
    /** Remove a digit from notes in the same row / column / box when it is placed. */
    autoRemoveNotes: true,
    /** The "hold a number" tip was shown and the player has used number lock (not a visible setting). */
    numberLockTipSeen: false,
  },
  2,
  {
    // v1 → v2: "Fill single notes" (autoFillSingles) moved from Settings to the per-game
    // Autofill switch in the game screen, because it must start off in every game.
    1: ({ autoFillSingles: _removed, ...rest }: Record<string, unknown>) => rest,
  },
);

/** games/game/sudoku/stats and games/game/sudoku/daily */
export const sudokuStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'easy', label: 'Easy' },
    { id: 'medium', label: 'Medium' },
    { id: 'hard', label: 'Hard' },
    { id: 'expert', label: 'Expert' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/**
 * games/game/sudoku/save: the one game in progress (survives the app being killed in the
 * background). Schema version 1 = the SudokuGame interface in state.ts.
 */
export const savedGame = defineStore<SudokuGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});

export interface CachedPuzzle {
  puzzle: number[];
  solution: number[];
}

/** Pre-generated puzzles per difficulty so "New game" is instant. Disposable. */
export const poolCache = defineCache<Partial<Record<string, CachedPuzzle[]>>>(cacheKey(GAME_ID, 'pool'), 1);

/** Today's daily puzzle. Disposable. */
export const dailyCache = defineCache<{ date: string; p: CachedPuzzle }>(cacheKey(GAME_ID, 'daily-puzzle'), 1);
