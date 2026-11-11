import { todayKey } from '../../core/daily';
import { createRng, hashString } from '../../core/random';
import { numbersSave, numbersStats } from './storage';
import { NumbersGame, NumbersMode, deal, newGame, startWith } from './state';

export const MODE_LABEL: Record<NumbersMode, string> = { relaxed: 'Relaxed', timed: 'Timed', daily: 'Daily' };

/** Today's numbers: the same for everyone on a given day, mostly one or two large numbers. */
export function dailyDeal(date: string): { large: number; numbers: number[]; target: number } {
  const rng = createRng(hashString(`numbers:${date}`));
  const large = [0, 1, 1, 2, 2, 2, 3, 4][Math.floor(rng() * 8)];
  return { large, ...deal(large, rng) };
}

/** A new game: the daily one starts dealt, the others start by picking large numbers. */
export function createGame(mode: NumbersMode): NumbersGame {
  if (mode !== 'daily') return newGame(mode);
  const date = todayKey();
  const d = dailyDeal(date);
  return startWith(newGame('daily', date), d.large, d.numbers, d.target);
}

/** Is there an in-progress game that starting a new one would throw away? */
export function hasGameToAbandon(): boolean {
  const g = numbersSave.get();
  return !!g && g.status === 'playing' && g.touched;
}

/** Abandon the current game; counts as not finished if the player had started playing. */
export function abandonSaved(): void {
  const g = numbersSave.get();
  if (g && g.status === 'playing' && g.touched) {
    numbersStats.record(g.mode, { outcome: 'abandoned', timeMs: g.elapsedMs, assists: g.hints });
  }
  numbersSave.set(null);
}

/** Replace any game in progress with a fresh one. */
export function startGame(mode: NumbersMode): void {
  const g = createGame(mode);
  abandonSaved();
  numbersSave.set(g);
}
