import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { hLine, vLine } from './engine';
import { CPU, YOU, newGame, reduce, score } from './state';

describe('dots and boxes game', () => {
  it('a completed box scores and earns another turn', () => {
    let g = newGame('easy', YOU);
    const s = { rows: 3, cols: 3 };
    g = { ...g, lines: g.lines.map((_, l) => [hLine(s, 0, 0), hLine(s, 1, 0), vLine(s, 0, 0)].includes(l)) };
    let ev;
    [g, ev] = reduce(g, { type: 'draw', line: vLine(s, 0, 1) });
    expect(ev).toMatchObject({ kind: 'drawn', boxes: [0] });
    expect(score(g, YOU)).toBe(1);
    expect(g.turn).toBe(YOU);
    [g] = reduce(g, { type: 'draw', line: hLine(s, 3, 2) });
    expect(g.turn).toBe(CPU);
  });

  it('plays a whole game against the computer, and undo returns to your turn', () => {
    let g = newGame('medium', YOU);
    [g] = reduce(g, { type: 'draw', line: 0 });
    [g] = reduce(g, { type: 'cpu', rng: createRng(1) });
    const [back] = reduce(g, { type: 'undo' });
    expect(back.lines.every((l) => !l)).toBe(true);
    const rng = createRng(2);
    for (let k = 0; k < 200 && g.status === 'playing'; k++) {
      if (g.turn === CPU) [g] = reduce(g, { type: 'cpu', rng });
      else [g] = reduce(g, { type: 'draw', line: g.lines.indexOf(false) });
    }
    expect(g.status).not.toBe('playing');
    expect(score(g, YOU) + score(g, CPU)).toBe(16);
  });
});
