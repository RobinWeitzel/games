/**
 * Arithmetic solver for the numbers game: combine numbers with + − × ÷ (each number used at
 * most once, every intermediate result a positive whole number) to reach a target.
 *
 * Works by dynamic programming over subsets: for every subset of the numbers it keeps every
 * value that can be made from exactly that subset, with a back-pointer to rebuild the steps.
 * Six numbers have 63 subsets; the whole table builds in a few milliseconds.
 */

export type Op = '+' | '-' | '*' | '/';
export const OPS: Op[] = ['+', '-', '*', '/'];

/** One calculation: `a op b = result`. For − and ÷, `a` is the larger number. */
export interface Step {
  a: number;
  op: Op;
  b: number;
  result: number;
}

/**
 * Apply an operation the way the game does: subtraction and division always take the larger
 * number first. Returns null when the result isn't a positive whole number.
 */
export function apply(x: number, op: Op, y: number): Step | null {
  const a = Math.max(x, y);
  const b = Math.min(x, y);
  switch (op) {
    case '+':
      return { a, op, b, result: a + b };
    case '*':
      return { a, op, b, result: a * b };
    case '-':
      return a === b ? null : { a, op, b, result: a - b };
    case '/':
      return b > 0 && a % b === 0 ? { a, op, b, result: a / b } : null;
  }
}

type Node = { leaf: true } | { leaf: false; op: Op; am: number; av: number; bm: number; bv: number };
type Table = Map<number, Node>[];

const lowBit = (m: number) => m & -m;
const popcount = (m: number) => {
  let n = 0;
  for (; m; m &= m - 1) n++;
  return n;
};

function build(nums: number[]): Table {
  const n = nums.length;
  const table: Table = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    const vals = new Map<number, Node>();
    table[mask] = vals;
    if (lowBit(mask) === mask) {
      vals.set(nums[Math.log2(mask)], { leaf: true });
      continue;
    }
    // Unordered splits: the part holding the lowest bit is `am`, the rest `bm`.
    const low = lowBit(mask);
    for (let am = (mask - 1) & mask; am; am = (am - 1) & mask) {
      if (!(am & low)) continue;
      const bm = mask ^ am;
      for (const av of table[am].keys()) {
        for (const bv of table[bm].keys()) {
          const hi = Math.max(av, bv);
          const lo = Math.min(av, bv);
          const add = (v: number, op: Op) => {
            if (!vals.has(v)) vals.set(v, { leaf: false, op, am, av, bm, bv });
          };
          add(hi + lo, '+');
          // ×1 and ÷1 never make anything new.
          if (lo !== 1) add(hi * lo, '*');
          if (hi !== lo) add(hi - lo, '-');
          if (lo !== 1 && hi % lo === 0) add(hi / lo, '/');
        }
      }
    }
  }
  return table;
}

function stepsFor(table: Table, mask: number, value: number, out: Step[]): void {
  const node = table[mask].get(value)!;
  if (node.leaf) return;
  stepsFor(table, node.am, node.av, out);
  stepsFor(table, node.bm, node.bv, out);
  out.push(apply(node.av, node.op, node.bv)!);
}

export interface Solution {
  /** The value the steps make (the target if `exact`). */
  value: number;
  exact: boolean;
  steps: Step[];
}

/**
 * Best way to reach `target` from `nums`: exact if possible, otherwise the closest value.
 * Prefers solutions that use the fewest numbers. Returns null for an empty list.
 */
export function solve(nums: number[], target: number): Solution | null {
  if (!nums.length) return null;
  const table = build(nums);
  const masks = table.map((_, m) => m).filter((m) => m > 0);
  masks.sort((x, y) => popcount(x) - popcount(y));
  let best: { mask: number; value: number } | null = null;
  for (const mask of masks) {
    if (table[mask].has(target)) {
      best = { mask, value: target };
      break;
    }
    for (const v of table[mask].keys()) {
      if (!best || Math.abs(v - target) < Math.abs(best.value - target)) best = { mask, value: v };
    }
  }
  const steps: Step[] = [];
  stepsFor(table, best!.mask, best!.value, steps);
  return { value: best!.value, exact: best!.value === target, steps };
}

/** Every value that can be made from `nums` (using any of them). */
export function reachable(nums: number[]): Set<number> {
  const out = new Set<number>();
  for (const vals of build(nums)) if (vals) for (const v of vals.keys()) out.add(v);
  return out;
}
