import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { pySave, pyStats } from './storage';
import { PyramidGame, PyramidMode, newGame } from './state';

export const MODE_LABEL: Record<PyramidMode, string> = { classic: 'Classic', daily: 'Daily' };

/** A new, winnable deal. The daily deal is the same for everyone on a date. */
export function createGame(mode: PyramidMode): PyramidGame {
  if (mode !== 'daily') return newGame(mode, createRng(randomSeed()));
  const date = todayKey();
  return newGame('daily', createRng(hashString(`pyramid:${date}`)), date);
}

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = pySave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: PyramidGame) => g.hints + g.undos;

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = pySave.get();
  if (g && g.status === 'playing' && g.touched) {
    pyStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  }
  pySave.set(null);
}

/** Replace any game in progress with a fresh one. */
export function startGame(mode: PyramidMode): void {
  const g = createGame(mode);
  abandonSaved();
  pySave.set(g);
}
