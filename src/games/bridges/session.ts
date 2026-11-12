import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { generate } from './engine';
import { brSave, brStats } from './storage';
import { BridgesGame, BridgesMode, newGame } from './state';

export const SIZE: Record<BridgesMode, number> = { easy: 7, medium: 9, hard: 11, daily: 9 };
export const MODE_LABEL: Record<BridgesMode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', daily: 'Daily' };

/** A new puzzle with one solution. The daily puzzle (9 × 9) is the same for everyone on a date. */
export function createGame(mode: BridgesMode): BridgesGame {
  const n = SIZE[mode];
  if (mode !== 'daily') return newGame({ mode, ...generate(n, n, createRng(randomSeed())) });
  const date = todayKey();
  return newGame({ mode, date, ...generate(n, n, createRng(hashString(`bridges:${date}`))) });
}

export function hasGameToAbandon(): boolean {
  const g = brSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: BridgesGame) => g.hints + g.undos;

export function abandonSaved(): void {
  const g = brSave.get();
  if (g && g.status === 'playing' && g.touched) brStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  brSave.set(null);
}

export function startGame(mode: BridgesMode): void {
  const g = createGame(mode);
  abandonSaved();
  brSave.set(g);
}
