/**
 * Everything TriPeaks persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { TriPeaksGame } from './state';

export const GAME_ID = 'tripeaks';

/** games/game/tripeaks/stats and games/game/tripeaks/daily */
export const tpStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'classic', label: 'Classic' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/** games/game/tripeaks/save: the one game in progress. Schema version 1 = TriPeaksGame in state.ts. */
export const tpSave = defineStore<TriPeaksGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
