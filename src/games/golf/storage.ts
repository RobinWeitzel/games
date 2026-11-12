/**
 * Everything Golf persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { GolfGame } from './state';

export const GAME_ID = 'golf';

/** games/game/golf/stats and games/game/golf/daily */
export const gfStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'classic', label: 'Classic' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/** games/game/golf/save: the one game in progress. Schema version 1 = GolfGame in state.ts. */
export const gfSave = defineStore<GolfGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
