/**
 * Everything the numbers game persists. Keep ALL storage declarations of the game in this
 * file; the storage contract test (src/core/storage/contract.test.ts) fails if a key or
 * version changes unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { NumbersGame } from './state';

export const GAME_ID = 'numbers';

/** games/game/numbers/stats and games/game/numbers/daily */
export const numbersStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'relaxed', label: 'Relaxed' },
    { id: 'timed', label: 'Timed' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/**
 * games/game/numbers/save: the one game in progress (survives the app being killed in the
 * background). Schema version 1 = the NumbersGame interface in state.ts.
 */
export const numbersSave = defineStore<NumbersGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
