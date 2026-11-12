import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { newGame, reduce, type SpiderGame } from './state';
import { newWinnableGame, solve } from './solver';

/** Play a solution through the game's own reducer. */
function replay(g: SpiderGame, path: NonNullable<ReturnType<typeof solve>>): SpiderGame {
  for (const step of path) {
    const [next, ev] = step === 'deal' ? reduce(g, { type: 'deal' }) : reduce(g, { type: 'move', ...step });
    expect(ev.kind).not.toBe('invalid');
    g = next;
  }
  return g;
}

describe('solver', () => {
  it('wins 1-suit deals, and its moves are legal in the game', () => {
    let won = 0;
    for (let s = 1; s <= 10; s++) {
      const g = newGame('suit1', createRng(s));
      const path = solve(g);
      if (!path) continue;
      won++;
      expect(replay(g, path).status).toBe('won');
    }
    expect(won).toBeGreaterThanOrEqual(7);
  });

  it('new 1 Suit and daily deals can be won; the daily is the same for the same seed', () => {
    for (const mode of ['suit1', 'daily'] as const) {
      const g = newWinnableGame(mode, createRng(42), mode === 'daily' ? '2026-11-12' : undefined);
      expect(solve(g)).not.toBeNull();
    }
    const a = newWinnableGame('daily', createRng(7), '2026-11-12');
    expect(a.date).toBe('2026-11-12');
    expect(a.tableau).toEqual(newWinnableGame('daily', createRng(7), '2026-11-12').tableau);
  });

  it('2 and 4 suit deals stay random (no solver run)', () => {
    expect(newWinnableGame('suit4', createRng(3))).toEqual(newGame('suit4', createRng(3)));
  });
});
