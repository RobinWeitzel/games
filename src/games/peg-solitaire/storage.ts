/**
 * Everything Peg Solitaire persists. Keep ALL storage declarations of the game in this file;
 * the storage contract test (src/core/storage/contract.test.ts) fails if a key or version
 * changes unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { PegGame } from './state';

export const GAME_ID = 'peg-solitaire';

/** games/game/peg-solitaire/stats (no daily: the boards are always the same). */
export const pgStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'english', label: 'Cross' },
    { id: 'triangle', label: 'Triangle' },
  ],
  daily: false,
});

/** games/game/peg-solitaire/save: the one game in progress. Schema version 1 = PegGame in state.ts. */
export const pgSave = defineStore<PegGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
