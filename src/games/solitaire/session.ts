import { todayKey } from '../../core/daily';
import { createRng, hashString, randomSeed } from '../../core/random';
import { solSave, solStats } from './storage';
import { SolitaireGame, SolitaireMode, newGame } from './state';

export const MODE_LABEL: Record<SolitaireMode, string> = { draw1: 'Draw 1', draw3: 'Draw 3', daily: 'Daily' };

/** A new, winnable deal. The daily deal is the same for everyone on a date (Draw 1). */
export function createGame(mode: SolitaireMode): SolitaireGame {
  if (mode !== 'daily') return newGame(mode, createRng(randomSeed()));
  const date = todayKey();
  return newGame('daily', createRng(hashString(`solitaire:${date}`)), date);
}

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = solSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: SolitaireGame) => g.hints + g.undos;

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = solSave.get();
  if (g && g.status === 'playing' && g.touched) {
    solStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  }
  solSave.set(null);
}

/** Replace any game in progress with a fresh one. */
export function startGame(mode: SolitaireMode): void {
  const g = createGame(mode);
  abandonSaved();
  solSave.set(g);
}
