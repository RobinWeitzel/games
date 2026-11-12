import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { newWinnableGame } from './solver';
import { spSave, spStats } from './storage';
import type { SpiderGame, SpiderMode } from './state';

export const MODE_LABEL: Record<SpiderMode, string> = { suit1: '1 Suit', suit2: '2 Suits', suit4: '4 Suits', daily: 'Daily' };

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = spSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: SpiderGame) => g.hints + g.undos;

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = spSave.get();
  if (g && g.status === 'playing' && g.touched) {
    spStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  }
  spSave.set(null);
}

/** A new deal; 1 Suit and the daily are winnable. The daily deal is the same for everyone on a date. */
export function createGame(mode: SpiderMode): SpiderGame {
  if (mode !== 'daily') return newWinnableGame(mode, createRng(randomSeed()));
  const date = todayKey();
  return newWinnableGame('daily', createRng(hashString(`spider:${date}`)), date);
}

/** Replace any game in progress with a fresh one. */
export function startGame(mode: SpiderMode): void {
  const g = createGame(mode);
  abandonSaved();
  spSave.set(g);
}
