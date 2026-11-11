import { dbSave, dbStats } from './storage';
import { CPU, DotsGame, DotsMode, YOU, newGame } from './state';

export const MODE_LABEL: Record<DotsMode, string> = { easy: 'Easy · 3 × 3', medium: 'Medium · 4 × 4', hard: 'Hard · 5 × 5' };

/** A new game; you and the computer take turns starting (by games played at this level). */
export function createGame(mode: DotsMode): DotsGame {
  return newGame(mode, dbStats.get(mode).played % 2 === 0 ? YOU : CPU);
}

export function hasGameToAbandon(): boolean {
  const g = dbSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

/** Leaving a started game counts as a game not won. */
export function abandonSaved(): void {
  const g = dbSave.get();
  if (g && g.status === 'playing' && g.touched) dbStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.undos });
  dbSave.set(null);
}

export function startGame(mode: DotsMode): void {
  abandonSaved();
  dbSave.set(createGame(mode));
}
