/**
 * Everything FreeCell persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { FreeCellGame } from './state';

export const GAME_ID = 'freecell';

/** games/game/freecell/stats and games/game/freecell/daily */
export const fcStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'classic', label: 'Classic' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/**
 * games/game/freecell/save: the one game in progress (survives the app being killed in the
 * background). Schema version 1 = the FreeCellGame interface in state.ts.
 */
export const fcSave = defineStore<FreeCellGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
