import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { generate } from './engine';
import { cdSave, cdStats } from './storage';
import { CalcudokuGame, CalcudokuMode, newGame } from './state';

export const SIZE: Record<CalcudokuMode, number> = { size4: 4, size5: 5, size6: 6, size7: 7, daily: 6 };
export const MODE_LABEL: Record<CalcudokuMode, string> = { size4: '4 × 4', size5: '5 × 5', size6: '6 × 6', size7: '7 × 7', daily: 'Daily' };

/** A new puzzle with one solution. The daily puzzle (6 × 6) is the same for everyone on a date. */
export function createGame(mode: CalcudokuMode): CalcudokuGame {
  if (mode !== 'daily') return newGame({ mode, ...generate(SIZE[mode], createRng(randomSeed())) });
  const date = todayKey();
  return newGame({ mode, date, ...generate(SIZE.daily, createRng(hashString(`calcudoku:${date}`))) });
}

export function hasGameToAbandon(): boolean {
  const g = cdSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = cdSave.get();
  if (g && g.status === 'playing' && g.touched) cdStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.hints });
  cdSave.set(null);
}

export function startGame(mode: CalcudokuMode): void {
  const g = createGame(mode);
  abandonSaved();
  cdSave.set(g);
}
