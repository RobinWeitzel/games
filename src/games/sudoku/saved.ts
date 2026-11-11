import { persistentStore } from '../../core/store';
import { recordResult } from '../../core/stats';
import type { SudokuGame } from './state';

/** The one game in progress (survives the app being killed in the background). */
export const savedGame = persistentStore<SudokuGame | null>('sudoku:save', null);

export const GAME_ID = 'sudoku';

/** Abandon the current game; counts as a loss if the player had started playing. */
export function abandonSaved(): void {
  const g = savedGame.get();
  if (g && g.status === 'playing' && g.touched) {
    recordResult(GAME_ID, g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.hints });
  }
  savedGame.set(null);
}
