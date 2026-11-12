/**
 * Everything Calcudoku persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { CalcudokuGame } from './state';

export const GAME_ID = 'calcudoku';

/** games/game/calcudoku/stats and games/game/calcudoku/daily */
export const cdStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'size4', label: '4 × 4' },
    { id: 'size5', label: '5 × 5' },
    { id: 'size6', label: '6 × 6' },
    { id: 'size7', label: '7 × 7' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/**
 * games/game/calcudoku/save: the one game in progress (survives the app being killed in the
 * background). Schema version 1 = the CalcudokuGame interface in state.ts.
 */
export const cdSave = defineStore<CalcudokuGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
