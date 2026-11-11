/**
 * Everything Codebreaker persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { CodebreakerGame } from './state';

export const GAME_ID = 'codebreaker';

/** games/game/codebreaker/stats and games/game/codebreaker/daily */
export const cbStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'classic', label: '4 of 6' },
    { id: 'hard', label: '5 of 8' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/** games/game/codebreaker/save: the one game in progress. Schema version 1 = CodebreakerGame in state.ts. */
export const cbSave = defineStore<CodebreakerGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
