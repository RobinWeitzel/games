import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { generate } from './engine';
import { ksSave, ksStats } from './storage';
import { KillerGame, KillerMode, newGame } from './state';

export const MODE_LABEL: Record<KillerMode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', daily: 'Daily' };

/** A new puzzle with one solution. The daily puzzle (Medium) is the same for everyone on a date. */
export function createGame(mode: KillerMode): KillerGame {
  if (mode !== 'daily') return newGame({ mode, difficulty: mode, ...generate(mode, createRng(randomSeed())) });
  const date = todayKey();
  return newGame({ mode, difficulty: 'medium', date, ...generate('medium', createRng(hashString(`killer-sudoku:${date}`))) });
}

export function hasGameToAbandon(): boolean {
  const g = ksSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export function abandonSaved(): void {
  const g = ksSave.get();
  if (g && g.status === 'playing' && g.touched) ksStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.hints });
  ksSave.set(null);
}

export function startGame(mode: KillerMode): void {
  const g = createGame(mode);
  abandonSaved();
  ksSave.set(g);
}
