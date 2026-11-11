import { describe, expect, it } from 'vitest';
import { BOARDS, solve } from './engine';
import { PegGame, isStuck, newGame, reduce, targets } from './state';

describe('boards', () => {
  it('has the 33-hole cross and the 15-hole triangle', () => {
    expect(BOARDS.english.holes).toHaveLength(33);
    expect(BOARDS.english.jumps).toHaveLength(76);
    expect(BOARDS.triangle.holes).toHaveLength(15);
    expect(BOARDS.triangle.jumps).toHaveLength(36);
  });

  it('both can be solved down to one peg, the cross even on the centre', () => {
    for (const b of Object.values(BOARDS)) {
      const path = solve(b, b.holes.map((_, i) => i !== b.start), 500000, true);
      expect(path).toHaveLength(b.holes.length - 2);
    }
  });
});

describe('game', () => {
  it('picks up a peg and jumps it over a neighbour into an empty hole', () => {
    let g = newGame('english');
    const b = BOARDS.english;
    const at = (r: number, c: number) => b.holes.findIndex((h) => h.r === r && h.c === c);
    [g] = reduce(g, { type: 'tap', hole: at(3, 1) });
    expect(targets(g)).toEqual([at(3, 3)]);
    let ev;
    [g, ev] = reduce(g, { type: 'tap', hole: at(3, 3) });
    expect(ev.kind).toBe('jumped');
    expect(g.pegs[at(3, 2)]).toBe(false);
    expect(g.pegs[at(3, 1)]).toBe(false);
    expect(g.pegs[at(3, 3)]).toBe(true);
    [g] = reduce(g, { type: 'undo' });
    expect(g.pegs).toEqual(newGame('english').pegs);
  });

  it('refuses jumps that aren’t legal', () => {
    const g = newGame('english');
    expect(reduce(g, { type: 'jump', from: 0, to: 16 })[1].kind).toBe('invalid');
  });

  it('hints lead to a win', () => {
    let g: PegGame = newGame('triangle');
    let ev;
    for (let k = 0; k < 13; k++) {
      [g, ev] = reduce(g, { type: 'hint' });
      expect(ev.kind === 'hint' && ev.jump).toBeTruthy();
      const j = ev.kind === 'hint' ? ev.jump! : null!;
      [g, ev] = reduce(g, { type: 'jump', from: j[0], to: j[2] });
    }
    expect(ev!.kind).toBe('won');
  });

  it('knows when no jump is left', () => {
    const g = newGame('triangle');
    const two = { ...g, pegs: g.pegs.map((_, i) => i === 0 || i === 14) };
    expect(isStuck(two)).toBe(true);
  });
});
