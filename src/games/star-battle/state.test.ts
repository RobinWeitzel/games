import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { countSolutions, generate, touching } from './engine';
import { CROSS, EMPTY, STAR, StarBattleGame, conflicts, newGame, reduce } from './state';

describe('engine', () => {
  it('knows which cells touch', () => {
    expect(touching(5, 0, 6)).toBe(true); // diagonal
    expect(touching(5, 0, 2)).toBe(false);
    expect(touching(5, 4, 5)).toBe(false); // end of a row and start of the next
  });

  it('generates puzzles with one solution that follows the rules', () => {
    for (const [n, k] of [
      [5, 1],
      [6, 1],
      [8, 1],
      [10, 2],
    ]) {
      const p = generate(n, k, createRng(n * 10 + k));
      expect(countSolutions(n, k, p.regions)).toBe(1);
      expect(p.solution).toHaveLength(n * k);
      expect(new Set(p.regions).size).toBe(n);
      const g = { ...newGame({ mode: 'small', ...p }), marks: p.regions.map((_, i) => (p.solution.includes(i) ? STAR : EMPTY)) };
      expect(conflicts(g).size).toBe(0);
      for (let r = 0; r < n; r++) expect(p.solution.filter((s) => Math.floor(s / n) === r)).toHaveLength(k);
      for (let gi = 0; gi < n; gi++) expect(p.solution.filter((s) => p.regions[s] === gi)).toHaveLength(k);
    }
  });

  it('is the same puzzle for the same seed (daily challenge)', () => {
    expect(generate(8, 1, createRng(3))).toEqual(generate(8, 1, createRng(3)));
  });
});

describe('game', () => {
  const p = generate(6, 1, createRng(1));
  const fresh = (): StarBattleGame => newGame({ mode: 'small', ...p });

  it('a tap cycles empty → cross → star → empty', () => {
    let g = fresh();
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      g = reduce(g, { type: 'tap', cell: 0 })[0];
      seen.push(g.marks[0]);
    }
    expect(seen).toEqual([CROSS, STAR, EMPTY]);
  });

  it('flags touching stars and too many in a row', () => {
    let g = fresh();
    g = { ...g, marks: g.marks.map((_, i) => (i === 0 || i === 7 ? STAR : EMPTY)) };
    expect([...conflicts(g)].sort()).toEqual([0, 7]);
    g = { ...g, marks: g.marks.map((_, i) => (i === 0 || i === 2 ? STAR : EMPTY)) };
    expect([...conflicts(g)].sort()).toEqual([0, 2]);
  });

  it('a drag crosses empty cells in one undo step', () => {
    let g = reduce(fresh(), { type: 'tap', cell: 1 })[0];
    g = reduce(g, { type: 'tap', cell: 1 })[0]; // star
    g = reduce(g, { type: 'cross', cells: [0, 1, 2, 3] })[0];
    expect(g.marks.slice(0, 4)).toEqual([CROSS, STAR, CROSS, CROSS]);
    g = reduce(g, { type: 'undo' })[0];
    expect(g.marks.slice(0, 4)).toEqual([EMPTY, STAR, EMPTY, EMPTY]);
  });

  it('hints solve the puzzle, fixing wrong stars on the way', () => {
    const wrong = [...Array(36).keys()].find((i) => !p.solution.includes(i))!;
    let g: StarBattleGame = { ...fresh(), marks: fresh().marks.map((_, i) => (i === wrong ? STAR : EMPTY)) };
    let ev;
    for (let i = 0; i < 20 && g.status === 'playing'; i++) [g, ev] = reduce(g, { type: 'hint' });
    expect(ev!.kind).toBe('won');
    expect(g.marks[wrong]).not.toBe(STAR);
  });
});
