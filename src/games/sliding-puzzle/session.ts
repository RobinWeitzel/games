import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { slSave, slStats } from './storage';
import { SlideGame, SlideMode, newGame } from './state';

export const SIZE: Record<SlideMode, number> = { size3: 3, size4: 4, size5: 5, daily: 4 };
export const MODE_LABEL: Record<SlideMode, string> = { size3: '3 × 3', size4: '4 × 4', size5: '5 × 5', daily: 'Daily' };

/** A new, solvable arrangement. The daily one (4 × 4) is the same for everyone on a date. */
export function createGame(mode: SlideMode): SlideGame {
  if (mode !== 'daily') return newGame(mode, SIZE[mode], createRng(randomSeed()));
  const date = todayKey();
  return newGame('daily', 4, createRng(hashString(`sliding-puzzle:${date}`)), date);
}

export function hasGameToAbandon(): boolean {
  const g = slSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export function abandonSaved(): void {
  const g = slSave.get();
  if (g && g.status === 'playing' && g.touched) slStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.undos });
  slSave.set(null);
}

export function startGame(mode: SlideMode): void {
  abandonSaved();
  slSave.set(createGame(mode));
}
