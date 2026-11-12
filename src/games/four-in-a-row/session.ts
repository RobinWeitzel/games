import { frSave, frStats } from './storage';
import { CPU, FourGame, FourMode, YOU, newGame } from './state';

export const MODE_LABEL: Record<FourMode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** A new game; you and the computer take turns starting (by games played at this level). */
export function createGame(mode: FourMode): FourGame {
  return newGame(mode, frStats.get(mode).played % 2 === 0 ? YOU : CPU);
}

export function hasGameToAbandon(): boolean {
  const g = frSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

/** Leaving a started game counts as a game not won. */
export function abandonSaved(): void {
  const g = frSave.get();
  if (g && g.status === 'playing' && g.touched) frStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.undos });
  frSave.set(null);
}

export function startGame(mode: FourMode): void {
  abandonSaved();
  frSave.set(createGame(mode));
}
