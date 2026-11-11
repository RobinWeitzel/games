import { todayKey } from '../../core/daily';
import { createRng, hashString } from '../../core/random';
import { ngSave, ngStats } from './storage';
import { NonogramGame, NonogramMode, SIZES, newGame } from './state';

export const MODE_LABEL: Record<NonogramMode, string> = { small: '5 × 5', medium: '10 × 10', large: '15 × 15', daily: 'Daily' };

/** "10 × 10" */
export const sizeLabel = (mode: NonogramMode) => `${SIZES[mode]} × ${SIZES[mode]}`;

/** A new game. The daily picture is the same for everyone on a date. */
export function createGame(mode: NonogramMode): NonogramGame {
  if (mode !== 'daily') return newGame(mode, Math.random);
  const date = todayKey();
  return newGame('daily', createRng(hashString(`nonogram:${date}`)), date);
}

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = ngSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = ngSave.get();
  if (g && g.status === 'playing' && g.touched) {
    ngStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.hints });
  }
  ngSave.set(null);
}

/** Replace any game in progress with a fresh one. */
export function startGame(mode: NonogramMode): void {
  const g = createGame(mode);
  abandonSaved();
  ngSave.set(g);
}
