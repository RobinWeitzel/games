import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { Cage, cageHolds, cageLabel, cageTuples, countSolutions, generate, latinSquare } from './engine';
import { newGame, reduce, restart } from './state';

describe('engine', () => {
  it('builds Latin squares', () => {
    for (const n of [4, 5, 6, 7]) {
      const g = latinSquare(n, createRng(n));
      for (let r = 0; r < n; r++) expect(new Set(g.slice(r * n, r * n + n)).size).toBe(n);
      for (let c = 0; c < n; c++) expect(new Set(Array.from({ length: n }, (_, r) => g[r * n + c])).size).toBe(n);
    }
  });

  it('checks cage operations in any order', () => {
    expect(cageHolds('−', 2, [1, 3])).toBe(true);
    expect(cageHolds('−', 2, [3, 1])).toBe(true);
    expect(cageHolds('÷', 3, [2, 6])).toBe(true);
    expect(cageHolds('÷', 3, [6, 3])).toBe(false);
    expect(cageHolds('×', 24, [2, 3, 4])).toBe(true);
    expect(cageHolds('+', 7, [3, 4])).toBe(true);
    expect(cageLabel({ cells: [0], op: '=', target: 4 })).toBe('4');
    expect(cageLabel({ cells: [0, 1], op: '÷', target: 2 })).toBe('2÷');
  });

  it('lists the ways to fill a cage, without repeats in a row or column', () => {
    // Two cells side by side in a 4×4: 3 apart → 1/4 either way.
    expect(cageTuples(4, { cells: [0, 1], op: '−', target: 3 })).toEqual([
      [1, 4],
      [4, 1],
    ]);
    // An L of three cells: the corner can't repeat its neighbours, but the two ends can be equal.
    const l: Cage = { cells: [0, 1, 4], op: '+', target: 4 };
    expect(cageTuples(4, l)).toEqual([[2, 1, 1]]); // cell 0 is the corner
  });

  it('generates puzzles with exactly one solution', () => {
    for (const n of [4, 5, 6, 7]) {
      const p = generate(n, createRng(100 + n));
      expect(countSolutions(n, p.cages, 2)).toBe(1);
      expect(p.cages.flatMap((c) => c.cells).sort((a, b) => a - b)).toEqual(Array.from({ length: n * n }, (_, i) => i));
      for (const c of p.cages) expect(cageHolds(c.op, c.target, c.cells.map((i) => p.solution[i]))).toBe(true);
    }
  });

  it('is the same puzzle for the same seed (daily challenge)', () => {
    expect(generate(6, createRng(7))).toEqual(generate(6, createRng(7)));
  });
});

describe('game', () => {
  const p = generate(4, createRng(3));
  const fresh = () => newGame({ mode: 'size4', ...p });

  it('marks wrong digits as mistakes and lets the player fix them', () => {
    let g = reduce(fresh(), { type: 'select', cell: 0 })[0];
    const wrong = (p.solution[0] % 4) + 1;
    let ev;
    [g, ev] = reduce(g, { type: 'input', digit: wrong });
    expect(ev.kind).toBe('mistake');
    expect(g.mistakes).toBe(1);
    [g, ev] = reduce(g, { type: 'input', digit: p.solution[0] });
    expect(ev.kind).toBe('correct');
    // A correct digit is locked.
    expect(reduce(g, { type: 'erase' })[0]).toBe(g);
  });

  it('notes toggle, and a placed digit clears its notes in the row and column', () => {
    let g = reduce(fresh(), { type: 'toggleNotes' })[0];
    const d = p.solution[0];
    g = reduce(reduce(g, { type: 'select', cell: 1 })[0], { type: 'input', digit: d })[0];
    expect(g.notes[1]).toBe(1 << d);
    g = reduce(reduce(reduce(g, { type: 'toggleNotes' })[0], { type: 'select', cell: 0 })[0], { type: 'input', digit: d })[0];
    expect(g.notes[1]).toBe(0);
  });

  it('undo restores the board', () => {
    const g0 = reduce(fresh(), { type: 'select', cell: 5 })[0];
    const g1 = reduce(g0, { type: 'input', digit: p.solution[5] })[0];
    const g2 = reduce(g1, { type: 'undo' })[0];
    expect(g2.values).toEqual(g0.values);
  });

  it('hints fill cells until the puzzle is solved', () => {
    let g = fresh();
    let ev;
    for (let k = 0; k < 16; k++) [g, ev] = reduce(g, { type: 'hint' });
    expect(ev!.kind).toBe('won');
    expect(g.status).toBe('won');
    expect(g.hints).toBe(16);
  });

  it('restart clears digits, notes and undo, keeping mistakes, hints and time', () => {
    const g0 = fresh();
    expect(restart(g0)).toBe(g0);
    const g = { ...reduce(g0, { type: 'hint' })[0], mistakes: 2, elapsedMs: 5000 };
    expect(g.values).not.toEqual(g0.values);
    const r = restart(g);
    expect(r.values).toEqual(g0.values);
    expect(r.notes).toEqual(g0.notes);
    expect(r).toMatchObject({ status: 'playing', undo: [], hints: 1, mistakes: 2, elapsedMs: 5000 });
    expect(restart(r)).toBe(r);
  });
});
