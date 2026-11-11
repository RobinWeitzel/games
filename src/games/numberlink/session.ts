import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { generate } from './engine';
import { nlSave, nlStats } from './storage';
import { NumberlinkGame, NumberlinkMode, newGame } from './state';

export const SIZE: Record<NumberlinkMode, number> = { small: 5, medium: 7, large: 9, daily: 7 };
export const MODE_LABEL: Record<NumberlinkMode, string> = { small: '5 × 5', medium: '7 × 7', large: '9 × 9', daily: 'Daily' };

/** A new puzzle. The daily puzzle (7 × 7) is the same for everyone on a date. */
export function createGame(mode: NumberlinkMode): NumberlinkGame {
  if (mode !== 'daily') return newGame({ mode, ...generate(SIZE[mode], createRng(randomSeed())) });
  const date = todayKey();
  return newGame({ mode, date, ...generate(SIZE.daily, createRng(hashString(`numberlink:${date}`))) });
}

export function hasGameToAbandon(): boolean {
  const g = nlSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: NumberlinkGame) => g.hints + g.undos;

export function abandonSaved(): void {
  const g = nlSave.get();
  if (g && g.status === 'playing' && g.touched) nlStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  nlSave.set(null);
}

export function startGame(mode: NumberlinkMode): void {
  abandonSaved();
  nlSave.set(createGame(mode));
}
