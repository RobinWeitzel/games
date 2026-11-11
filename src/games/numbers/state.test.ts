import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/random';
import { Action, NumbersGame, TARGET_MAX, TARGET_MIN, deal, newGame, points, reduce, solution, startWith } from './state';
import { apply, reachable, solve } from './solver';
import { dailyDeal } from './session';

const run = (g: NumbersGame, ...actions: Action[]) => actions.reduce((acc, a) => reduce(acc, a)[0], g);
const fixed = (numbers: number[], target: number) => startWith(newGame('relaxed'), 2, numbers, target);

describe('numbers solver', () => {
  it('takes the larger number first and rejects fractions, zero and negatives', () => {
    expect(apply(3, '-', 10)).toEqual({ a: 10, op: '-', b: 3, result: 7 });
    expect(apply(5, '-', 5)).toBeNull();
    expect(apply(3, '/', 12)?.result).toBe(4);
    expect(apply(7, '/', 3)).toBeNull();
  });

  it('finds an exact solution whose steps check out', () => {
    const nums = [100, 75, 50, 25, 6, 3];
    const sol = solve(nums, 952)!;
    expect(sol.exact).toBe(true);
    const pool = [...nums];
    for (const s of sol.steps) {
      for (const v of [s.a, s.b]) {
        const i = pool.indexOf(v);
        expect(i).toBeGreaterThanOrEqual(0);
        pool.splice(i, 1);
      }
      expect(apply(s.a, s.op, s.b)?.result).toBe(s.result);
      pool.push(s.result);
    }
    expect(sol.steps[sol.steps.length - 1].result).toBe(952);
  });

  it('returns the closest value when the target is out of reach', () => {
    const sol = solve([1, 1, 2, 2, 3, 3], 952)!;
    expect(sol.exact).toBe(false);
    expect(sol.value).toBe(Math.max(...reachable([1, 1, 2, 2, 3, 3])));
  });

  it('uses a number on its own when it already is the target', () => {
    expect(solve([25, 4, 100], 100)).toEqual({ value: 100, exact: true, steps: [] });
  });
});

describe('numbers dealing', () => {
  it('deals the requested large numbers and a reachable target', () => {
    const rng = createRng(7);
    for (let large = 0; large <= 4; large++) {
      const { numbers, target } = deal(large, rng);
      expect(numbers).toHaveLength(6);
      expect(numbers.filter((n) => n > 10)).toHaveLength(large);
      expect(target).toBeGreaterThanOrEqual(TARGET_MIN);
      expect(target).toBeLessThanOrEqual(TARGET_MAX);
      expect(solve(numbers, target)?.exact).toBe(true);
    }
  });

  it('never deals a small number more than twice', () => {
    const rng = createRng(11);
    for (let i = 0; i < 20; i++) {
      const { numbers } = deal(0, rng);
      for (const n of numbers) expect(numbers.filter((m) => m === n).length).toBeLessThanOrEqual(2);
    }
  });

  it('gives everyone the same daily numbers', () => {
    expect(dailyDeal('2026-11-11')).toEqual(dailyDeal('2026-11-11'));
    expect(dailyDeal('2026-11-11')).not.toEqual(dailyDeal('2026-11-12'));
  });

  it('starts by picking, then deals', () => {
    const g = newGame('timed');
    expect(g.status).toBe('picking');
    const next = run(g, { type: 'pick', large: 2, rng: createRng(1) });
    expect(next.status).toBe('playing');
    expect(next.large).toBe(2);
    expect(next.slots).toEqual(next.numbers);
  });
});

describe('numbers play', () => {
  it('combines two numbers into the second slot and selects the result', () => {
    const [g, ev] = reduce(run(fixed([100, 75, 50, 25, 6, 3], 952), { type: 'tapSlot', slot: 4 }, { type: 'tapOp', op: '*' }), { type: 'tapSlot', slot: 5 });
    expect(ev).toEqual({ kind: 'move', slot: 5 });
    expect(g.slots).toEqual([100, 75, 50, 25, null, 18]);
    expect(g.selected).toBe(5);
    expect(g.moves).toHaveLength(1);
    expect(g.touched).toBe(true);
  });

  it('rejects uneven division without changing the board', () => {
    const g0 = run(fixed([100, 75, 50, 25, 6, 3], 952), { type: 'tapSlot', slot: 1 }, { type: 'tapOp', op: '/' });
    const [g, ev] = reduce(g0, { type: 'tapSlot', slot: 0 });
    expect(ev.kind).toBe('invalid');
    expect(g).toBe(g0);
  });

  it('wins on reaching the target exactly', () => {
    const g0 = fixed([100, 75, 50, 25, 6, 3], 106);
    const [g, ev] = reduce(run(g0, { type: 'tapSlot', slot: 0 }, { type: 'tapOp', op: '+' }), { type: 'tapSlot', slot: 4 });
    expect(ev.kind).toBe('won');
    expect(g.status).toBe('won');
    expect(points(g)).toBe(10);
  });

  it('undo and reset restore the board, and the closest value is kept', () => {
    const g0 = fixed([100, 75, 50, 25, 6, 3], 952);
    const g1 = run(g0, { type: 'tapSlot', slot: 0 }, { type: 'tapOp', op: '*' }, { type: 'tapSlot', slot: 3 }); // 2500
    const g2 = run(g1, { type: 'tapOp', op: '-' }, { type: 'tapSlot', slot: 1 }); // 2425
    expect(run(g2, { type: 'undo' }).slots).toEqual(g1.slots);
    expect(run(g2, { type: 'reset' }).slots).toEqual(g0.numbers);
    expect(g2.closest).toBe(100); // 100 is still closer to 952 than 2500 or 2425
  });

  it('hints suggest a first step and count as assists', () => {
    const [g, ev] = reduce(fixed([100, 75, 50, 25, 6, 3], 952), { type: 'hint' });
    expect(ev.kind).toBe('hint');
    expect(ev.kind === 'hint' && ev.message).toMatch(/^Try \d+ [+−×÷] \d+$/);
    expect(g.hints).toBe(1);
  });

  it('time up and giving up lose the game, scored by the closest value', () => {
    const g = run(fixed([100, 75, 50, 25, 6, 3], 952), { type: 'tapSlot', slot: 0 }, { type: 'tapOp', op: '+' }, { type: 'tapSlot', slot: 4 });
    const [lost, ev] = reduce(g, { type: 'timeUp' });
    expect(ev.kind).toBe('lost');
    expect(lost.status).toBe('lost');
    expect(solution(lost).at(-1)?.result).toBe(952);
    expect(points({ ...lost, closest: 947 })).toBe(7);
    expect(points({ ...lost, closest: 942 })).toBe(5);
    expect(points({ ...lost, closest: 900 })).toBe(0);
  });

  it('reads a stored v1 save', () => {
    // Literal games/game/numbers/save data as written by the first release.
    const stored: NumbersGame = JSON.parse(
      '{"mode":"relaxed","status":"playing","large":1,"numbers":[50,2,3,7,7,9],"target":321,"slots":[50,null,3,7,7,18],"selected":5,"op":null,"moves":[{"a":9,"op":"*","b":2,"result":18,"before":[50,2,3,7,7,9]}],"closest":50,"hints":0,"elapsedMs":4200,"touched":true}',
    );
    const g = run(stored, { type: 'undo' });
    expect(g.slots).toEqual([50, 2, 3, 7, 7, 9]);
  });
});
