import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { cbSave, cbStats } from './storage';
import { CodebreakerGame, CodebreakerMode, newGame } from './state';

export const MODE_LABEL: Record<CodebreakerMode, string> = { classic: '4 of 6', hard: '5 of 8', daily: 'Daily' };

/** A new code. The daily code is the same for everyone on a date. */
export function createGame(mode: CodebreakerMode): CodebreakerGame {
  if (mode !== 'daily') return newGame(mode, createRng(randomSeed()));
  const date = todayKey();
  return newGame('daily', createRng(hashString(`codebreaker:${date}`)), date);
}

export function hasGameToAbandon(): boolean {
  const g = cbSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export function abandonSaved(): void {
  const g = cbSave.get();
  if (g && g.status === 'playing' && g.touched) cbStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.hints });
  cbSave.set(null);
}

export function startGame(mode: CodebreakerMode): void {
  abandonSaved();
  cbSave.set(createGame(mode));
}
