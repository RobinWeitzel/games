/**
 * Everything Reversi persists. Keep ALL storage declarations of the game in this file;
 * the storage contract test (src/core/storage/contract.test.ts) fails if a key or version
 * changes unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { ReversiGame } from './state';

export const GAME_ID = 'reversi';

/** games/game/reversi/stats (a draw is recorded as not won). */
export const rvStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'easy', label: 'Easy' },
    { id: 'medium', label: 'Medium' },
    { id: 'hard', label: 'Hard' },
  ],
  daily: false,
});

/** games/game/reversi/save: the one game in progress. Schema version 1 = ReversiGame in state.ts. */
export const rvSave = defineStore<ReversiGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
