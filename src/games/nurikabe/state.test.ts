import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { generate, isValidSolution, solve } from './engine';
import { DOT, EMPTY, NurikabeGame, SEA, newGame, numberStates, pools, progress, reduce, restart } from './state';

/** A puzzle from rows: digits are numbers, '#' sea and '.' land of the solution. */
function fromRows(rows: string[]) {
  const n = rows.length;
  const chars = rows.join('').split('');
  return { n, clues: chars.map((ch) => (/\d/.test(ch) ? Number(ch) : 0)), solution: chars.map((ch) => ch === '#') };
}

describe('engine', () => {
  it('checks the rules', () => {
    const p = fromRows(['2.#', '###', '1#1']);
    expect(isValidSolution(p.n, p.clues, p.solution)).toBe(true);
    // A 2 × 2 pool.
    const pool = fromRows(['1###', '#..#', '##3#', '1#1#']);
    expect(isValidSolution(pool.n, pool.clues, pool.solution)).toBe(false);
    // The sea in two parts.
    const split = fromRows(['#2#', '#.#', '#1#']);
    expect(isValidSolution(split.n, split.clues, split.solution)).toBe(false);
  });

  it('solves a small puzzle', () => {
    const p = fromRows(['2.#', '###', '1#1']);
    expect(solve(p.n, p.clues, 3)).toEqual([p.solution]);
  });

  it('sees a second solution', () => {
    // The island of 3 can bend left or right.
    const p = fromRows(['#3#', '#..', '###']);
    expect(solve(p.n, p.clues, 3).length).toBeGreaterThan(1);
  });

  it('generates puzzles with one solution', () => {
    for (const d of ['easy', 'medium'] as const) {
      const p = generate(d, createRng(4));
      expect(isValidSolution(p.n, p.clues, p.solution)).toBe(true);
      expect(solve(p.n, p.clues, 2, 100000)).toEqual([p.solution]);
    }
  });

  it('is the same puzzle for the same seed (daily challenge)', () => {
    expect(generate('medium', createRng(8))).toEqual(generate('medium', createRng(8)));
  });
});

describe('game', () => {
  const p = generate('easy', createRng(6));
  const fresh = (): NurikabeGame => newGame({ mode: 'easy', difficulty: 'easy', ...p });
  const blank = p.clues.findIndex((v) => !v);

  it('a tap cycles empty → sea → dot → empty; numbers cannot be marked', () => {
    let g = fresh();
    [g] = reduce(g, { type: 'tap', cell: blank });
    expect(g.marks[blank]).toBe(SEA);
    [g] = reduce(g, { type: 'tap', cell: blank });
    expect(g.marks[blank]).toBe(DOT);
    [g] = reduce(g, { type: 'tap', cell: blank });
    expect(g.marks[blank]).toBe(EMPTY);
    const num = p.clues.findIndex((v) => v > 0);
    expect(reduce(g, { type: 'tap', cell: num })[0]).toBe(g);
  });

  it('finds pools and wrong numbers', () => {
    const q = fromRows(['2.#', '###', '1#1']);
    let g = newGame({ mode: 'easy', difficulty: 'easy', ...q });
    let ev;
    [g, ev] = reduce(g, { type: 'paint', cells: [1, 3, 4], value: SEA });
    expect(pools(g).size).toBe(0);
    expect(numberStates(g).get(0)).toBe('bad'); // a 2 with no room
    expect(ev.kind === 'changed' && ev.mistake).toBe(true);
    [g] = reduce(g, { type: 'undo' });
    [g] = reduce(g, { type: 'paint', cells: [2, 3, 4, 5, 7], value: SEA });
    expect(numberStates(g).get(0)).toBe('ok');
    expect(g.status).toBe('won');
  });

  it('a 2 × 2 block of sea is a pool', () => {
    const q = fromRows(['1###', '#..#', '##3#', '1#1#']);
    let g = newGame({ mode: 'easy', difficulty: 'easy', ...q });
    [g] = reduce(g, { type: 'paint', cells: [1, 2, 3, 7], value: SEA });
    expect(pools(g).size).toBe(0);
    let ev;
    [g, ev] = reduce(g, { type: 'tap', cell: 6 });
    expect([...pools(g)].sort((a, b) => a - b)).toEqual([2, 3, 6, 7]);
    expect(ev.kind === 'changed' && ev.mistake).toBe(true);
  });

  it('hints solve the puzzle, fixing wrong marks first', () => {
    let g = fresh();
    const land = p.solution.findIndex((s, i) => !s && !p.clues[i]);
    if (land >= 0) {
      [g] = reduce(g, { type: 'paint', cells: [land], value: SEA });
      let ev;
      [g, ev] = reduce(g, { type: 'hint' });
      expect(ev).toEqual({ kind: 'hint', cell: land });
      expect(g.marks[land]).toBe(EMPTY);
    }
    let ev;
    for (let k = 0; k < 60 && g.status === 'playing'; k++) [g, ev] = reduce(g, { type: 'hint' });
    expect(ev!.kind).toBe('won');
    expect(progress(g)).toBe(1);
  });

  it('restart clears the board, keeps time and hints, and counts as an undo', () => {
    const g0 = fresh();
    expect(restart(g0)).toBe(g0);
    const g = { ...reduce(g0, { type: 'hint' })[0], elapsedMs: 5000 };
    expect(g.marks).not.toEqual(g0.marks);
    const r = restart(g);
    expect(r.marks).toEqual(g0.marks);
    expect(r).toMatchObject({ status: 'playing', history: [], hints: g.hints, undos: g.undos + 1, elapsedMs: 5000 });
    expect(restart(r)).toBe(r);
  });
});
