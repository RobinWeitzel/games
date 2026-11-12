/**
 * Everything Star Battle persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { StarBattleGame } from './state';

export const GAME_ID = 'star-battle';

/** games/game/star-battle/stats and games/game/star-battle/daily */
export const sbStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'small', label: '6 × 6' },
    { id: 'medium', label: '8 × 8' },
    { id: 'large', label: '10 × 10, 2 stars' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/** games/game/star-battle/save: the one game in progress. Schema version 1 = StarBattleGame in state.ts. */
export const sbSave = defineStore<StarBattleGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
