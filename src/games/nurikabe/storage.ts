/**
 * Everything Nurikabe persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { NurikabeGame } from './state';

export const GAME_ID = 'nurikabe';

/** games/game/nurikabe/stats and games/game/nurikabe/daily */
export const nkStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'easy', label: 'Easy' },
    { id: 'medium', label: 'Medium' },
    { id: 'hard', label: 'Hard' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/** games/game/nurikabe/save: the one game in progress. Schema version 1 = NurikabeGame in state.ts. */
export const nkSave = defineStore<NurikabeGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
