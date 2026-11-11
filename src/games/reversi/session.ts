import { rvSave, rvStats } from './storage';
import { CPU, ReversiGame, ReversiMode, YOU, newGame } from './state';

export const MODE_LABEL: Record<ReversiMode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** A new game; you and the computer take turns starting (by games played at this level). */
export function createGame(mode: ReversiMode): ReversiGame {
  return newGame(mode, rvStats.get(mode).played % 2 === 0 ? YOU : CPU);
}

export function hasGameToAbandon(): boolean {
  const g = rvSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

/** Leaving a started game counts as a game not won. */
export function abandonSaved(): void {
  const g = rvSave.get();
  if (g && g.status === 'playing' && g.touched) rvStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.undos });
  rvSave.set(null);
}

export function startGame(mode: ReversiMode): void {
  abandonSaved();
  rvSave.set(createGame(mode));
}
