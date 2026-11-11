/**
 * Everything Nonogram persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameSettings } from '../../core/settings';
import { createGameStats } from '../../core/stats';
import type { NonogramGame } from './state';

export const GAME_ID = 'nonogram';

/** games/game/nonogram/settings */
export const ngSettings = createGameSettings(GAME_ID, {
  /** The player has dragged across cells (the tip is no longer shown). Not a visible setting. */
  dragTipSeen: false,
});

/** games/game/nonogram/stats and games/game/nonogram/daily */
export const ngStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'small', label: '5 × 5' },
    { id: 'medium', label: '10 × 10' },
    { id: 'large', label: '15 × 15' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/**
 * games/game/nonogram/save: the one game in progress (survives the app being killed in the
 * background). Schema version 1 = the NonogramGame interface in state.ts.
 */
export const ngSave = defineStore<NonogramGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
