import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { SIZE, generate } from './engine';
import { kkSave, kkStats } from './storage';
import { KakuroGame, KakuroMode, newGame } from './state';

export const MODE_LABEL: Record<KakuroMode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', daily: 'Daily' };
/** Size of the white area (the grid without its clue row and column). */
export const sizeText = (m: keyof typeof SIZE) => `${SIZE[m] - 1} × ${SIZE[m] - 1}`;

/** A new puzzle with one solution. The daily puzzle (Medium) is the same for everyone on a date. */
export function createGame(mode: KakuroMode): KakuroGame {
  if (mode !== 'daily') return newGame({ mode, difficulty: mode, ...generate(mode, createRng(randomSeed())) });
  const date = todayKey();
  return newGame({ mode, difficulty: 'medium', date, ...generate('medium', createRng(hashString(`kakuro:${date}`))) });
}

export function hasGameToAbandon(): boolean {
  const g = kkSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export function abandonSaved(): void {
  const g = kkSave.get();
  if (g && g.status === 'playing' && g.touched) kkStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.hints });
  kkSave.set(null);
}

export function startGame(mode: KakuroMode): void {
  const g = createGame(mode);
  abandonSaved();
  kkSave.set(g);
}
