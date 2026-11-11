import { pgSave, pgStats } from './storage';
import { PegGame, PegMode, newGame } from './state';

export const MODE_LABEL: Record<PegMode, string> = { english: 'Cross', triangle: 'Triangle' };

export function hasGameToAbandon(): boolean {
  const g = pgSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: PegGame) => g.hints + g.undos;

export function abandonSaved(): void {
  const g = pgSave.get();
  if (g && g.status === 'playing' && g.touched) pgStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  pgSave.set(null);
}

export function startGame(mode: PegMode): void {
  abandonSaved();
  pgSave.set(newGame(mode));
}
