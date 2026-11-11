import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { gfSave, gfStats } from './storage';
import { GolfGame, GolfMode, newGame } from './state';

export const MODE_LABEL: Record<GolfMode, string> = { classic: 'Classic', daily: 'Daily' };

/** A new, winnable deal. The daily deal is the same for everyone on a date. */
export function createGame(mode: GolfMode): GolfGame {
  if (mode !== 'daily') return newGame(mode, createRng(randomSeed()));
  const date = todayKey();
  return newGame('daily', createRng(hashString(`golf:${date}`)), date);
}

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = gfSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: GolfGame) => g.hints + g.undos;

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = gfSave.get();
  if (g && g.status === 'playing' && g.touched) {
    gfStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  }
  gfSave.set(null);
}

/** Replace any game in progress with a fresh one. */
export function startGame(mode: GolfMode): void {
  const g = createGame(mode);
  abandonSaved();
  gfSave.set(g);
}
