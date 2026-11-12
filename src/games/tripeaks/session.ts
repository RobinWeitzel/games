import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { tpSave, tpStats } from './storage';
import { TriPeaksGame, TriPeaksMode, newGame } from './state';

export const MODE_LABEL: Record<TriPeaksMode, string> = { classic: 'Classic', daily: 'Daily' };

/** A new, winnable deal. The daily deal is the same for everyone on a date. */
export function createGame(mode: TriPeaksMode): TriPeaksGame {
  if (mode !== 'daily') return newGame(mode, createRng(randomSeed()));
  const date = todayKey();
  return newGame('daily', createRng(hashString(`tripeaks:${date}`)), date);
}

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = tpSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: TriPeaksGame) => g.hints + g.undos;

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = tpSave.get();
  if (g && g.status === 'playing' && g.touched) {
    tpStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  }
  tpSave.set(null);
}

/** Replace any game in progress with a fresh one. */
export function startGame(mode: TriPeaksMode): void {
  const g = createGame(mode);
  abandonSaved();
  tpSave.set(g);
}
