/**
 * Everything the sliding puzzle persists. Keep ALL storage declarations of the game in this
 * file; the storage contract test (src/core/storage/contract.test.ts) fails if a key or version
 * changes unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { SlideGame } from './state';

export const GAME_ID = 'sliding-puzzle';

/** games/game/sliding-puzzle/stats and games/game/sliding-puzzle/daily */
export const slStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'size3', label: '3 × 3' },
    { id: 'size4', label: '4 × 4' },
    { id: 'size5', label: '5 × 5' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/** games/game/sliding-puzzle/save: the one game in progress. Schema version 1 = SlideGame in state.ts. */
export const slSave = defineStore<SlideGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
