import { createRng, randomSeed } from '../../core/random';
import { spSave, spStats } from './storage';
import { SpiderGame, SpiderMode, newGame } from './state';

export const MODE_LABEL: Record<SpiderMode, string> = { suit1: '1 Suit', suit2: '2 Suits', suit4: '4 Suits' };

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = spSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

export const assistsOf = (g: SpiderGame) => g.hints + g.undos;

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = spSave.get();
  if (g && g.status === 'playing' && g.touched) {
    spStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: assistsOf(g) });
  }
  spSave.set(null);
}

export const createGame = (mode: SpiderMode) => newGame(mode, createRng(randomSeed()));

/** Replace any game in progress with a fresh one. */
export function startGame(mode: SpiderMode): void {
  abandonSaved();
  spSave.set(createGame(mode));
}
