/**
 * Everything Spider persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameStats } from '../../core/stats';
import type { SpiderGame } from './state';

export const GAME_ID = 'spider';

/** games/game/spider/stats and games/game/spider/daily (added in the second release of Spider) */
export const spStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'suit1', label: '1 Suit' },
    { id: 'suit2', label: '2 Suits' },
    { id: 'suit4', label: '4 Suits' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/**
 * games/game/spider/save: the one game in progress (survives the app being killed in the
 * background). Schema version 1 = the SpiderGame interface in state.ts.
 */
export const spSave = defineStore<SpiderGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
