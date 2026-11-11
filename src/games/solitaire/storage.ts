/**
 * Everything Solitaire persists. Keep ALL storage declarations of the game in this file; the
 * storage contract test (src/core/storage/contract.test.ts) fails if a key or version changes
 * unexpectedly.
 *
 * Changing the shape of any of these? Read docs/STORAGE.md first.
 */
import { defineStore, gameKey } from '../../core/storage';
import { createGameSettings } from '../../core/settings';
import { createGameStats } from '../../core/stats';
import type { SolitaireGame } from './state';

export const GAME_ID = 'solitaire';

/** games/game/solitaire/settings */
export const solSettings = createGameSettings(GAME_ID, {
  /** The player has moved a card by dragging it (the tip is no longer shown). Not a visible setting. */
  dragTipSeen: false,
});

/** games/game/solitaire/stats and games/game/solitaire/daily */
export const solStats = createGameStats(GAME_ID, {
  // Mode ids are stored; never rename them (labels can change freely).
  modes: [
    { id: 'draw1', label: 'Draw 1' },
    { id: 'draw3', label: 'Draw 3' },
    { id: 'daily', label: 'Daily' },
  ],
  daily: true,
});

/**
 * games/game/solitaire/save: the one game in progress (survives the app being killed in the
 * background). Schema version 1 = the SolitaireGame interface in state.ts.
 */
export const solSave = defineStore<SolitaireGame | null>({
  key: gameKey(GAME_ID, 'save'),
  version: 1,
  initial: null,
});
