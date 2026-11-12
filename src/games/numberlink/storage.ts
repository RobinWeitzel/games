/**
 * Everything Numberlink persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { NumberlinkGame } from './state';

export const GAME_ID = 'numberlink';

/** games/game/numberlink/stats and games/game/numberlink/daily */
export const nlStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'small', label: '5 × 5' },
    { id: 'medium', label: '7 × 7' },
    { id: 'large', label: '9 × 9' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/** games/game/numberlink/save: the one game in progress. Schema version 1 = NumberlinkGame in state.ts. */
export const nlSave = defineStore<NumberlinkGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
