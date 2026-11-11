import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { generate } from './engine';
import { luSave, luStats } from './storage';
import { LightUpGame, LightUpMode, newGame } from './state';

export const SIZE = { easy: 7, medium: 10, hard: 10 } as const;
export const MODE_LABEL: Record<LightUpMode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', daily: 'Daily' };

/** A new puzzle with one solution. The daily puzzle (Medium) is the same for everyone on a date. */
export function createGame(mode: LightUpMode): LightUpGame {
  if (mode !== 'daily') return newGame({ mode, difficulty: mode, ...generate(SIZE[mode], mode, createRng(randomSeed())) });
  const date = todayKey();
  return newGame({ mode, difficulty: 'medium', date, ...generate(SIZE.medium, 'medium', createRng(hashString(`light-up:${date}`))) });
}

export function hasGameToAbandon(): boolean {
  const g = luSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: LightUpGame) => g.hints + g.undos;

export function abandonSaved(): void {
  const g = luSave.get();
  if (g && g.status === 'playing' && g.touched) luStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  luSave.set(null);
}

export function startGame(mode: LightUpMode): void {
  const g = createGame(mode);
  abandonSaved();
  luSave.set(g);
}
