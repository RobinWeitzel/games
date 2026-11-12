/**
 * Everything Kakuro persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { KakuroGame } from './state';

export const GAME_ID = 'kakuro';

/** games/game/kakuro/stats and games/game/kakuro/daily */
export const kkStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'easy', label: 'Easy' },
    { id: 'medium', label: 'Medium' },
    { id: 'hard', label: 'Hard' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/** games/game/kakuro/save: the one game in progress. Schema version 1 = KakuroGame in state.ts. */
export const kkSave = defineStore<KakuroGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
