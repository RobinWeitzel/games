import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { generate } from './engine';
import { sbSave, sbStats } from './storage';
import { StarBattleGame, StarBattleMode, newGame } from './state';

export const SHAPE: Record<StarBattleMode, { n: number; k: number }> = {
  small: { n: 6, k: 1 },
  medium: { n: 8, k: 1 },
  large: { n: 10, k: 2 },
  daily: { n: 8, k: 1 },
};
export const MODE_LABEL: Record<StarBattleMode, string> = { small: '6 × 6', medium: '8 × 8', large: '10 × 10', daily: 'Daily' };

/** A new puzzle with one solution. The daily puzzle (8 × 8) is the same for everyone on a date. */
export function createGame(mode: StarBattleMode): StarBattleGame {
  const { n, k } = SHAPE[mode];
  if (mode !== 'daily') return newGame({ mode, ...generate(n, k, createRng(randomSeed())) });
  const date = todayKey();
  return newGame({ mode, date, ...generate(n, k, createRng(hashString(`star-battle:${date}`))) });
}

export function hasGameToAbandon(): boolean {
  const g = sbSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: StarBattleGame) => g.hints + g.undos;

export function abandonSaved(): void {
  const g = sbSave.get();
  if (g && g.status === 'playing' && g.touched) sbStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  sbSave.set(null);
}

export function startGame(mode: StarBattleMode): void {
  const g = createGame(mode);
  abandonSaved();
  sbSave.set(g);
}
