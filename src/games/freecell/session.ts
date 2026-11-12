import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { fcSave, fcStats } from './storage';
import { FreeCellGame, FreeCellMode, newGame } from './state';

export const MODE_LABEL: Record<FreeCellMode, string> = { classic: 'Classic', daily: 'Daily' };

/** A new, winnable deal. The daily deal is the same for everyone on a date. */
export function createGame(mode: FreeCellMode): FreeCellGame {
  if (mode !== 'daily') return newGame(mode, createRng(randomSeed()));
  const date = todayKey();
  return newGame('daily', createRng(hashString(`freecell:${date}`)), date);
}

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = fcSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: FreeCellGame) => g.hints + g.undos;

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = fcSave.get();
  if (g && g.status === 'playing' && g.touched) {
    fcStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  }
  fcSave.set(null);
}

/** Replace any game in progress with a fresh one. */
export function startGame(mode: FreeCellMode): void {
  const g = createGame(mode);
  abandonSaved();
  fcSave.set(g);
}
