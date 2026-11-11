/**
 * The numbers game: pick how many large numbers you want, six numbers are drawn and a
 * three-digit target appears. Combine numbers with + − × ÷ to hit the target exactly.
 *
 * Pure game logic. The UI dispatches actions to `reduce` and reacts to the returned event.
 */
import { Rng, shuffle } from '../../core/random';
import { Op, Step, apply, reachable, solve } from './solver';

export type { Op, Step } from './solver';
export { OPS } from './solver';

export type NumbersMode = 'relaxed' | 'timed' | 'daily';

export const LARGE = [25, 50, 75, 100];
export const SMALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const SLOTS = 6;
export const MAX_LARGE = 4;
export const TARGET_MIN = 101;
export const TARGET_MAX = 999;
/** Time limit of the timed mode. */
export const TIME_LIMIT_MS = 30_000;

/** A calculation the player made, with the board before it (for undo). */
export interface Move extends Step {
  before: (number | null)[];
}

/**
 * The game in progress. Stored as games/game/numbers/save (schema v1): changing this shape
 * needs a store migration (docs/STORAGE.md).
 */
export interface NumbersGame {
  mode: NumbersMode;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  /** 'picking': choosing how many large numbers (no numbers drawn yet). */
  status: 'picking' | 'playing' | 'won' | 'lost';
  /** How many large numbers were drawn. */
  large: number;
  /** The six numbers drawn, in deal order. */
  numbers: number[];
  /** 0 while picking. */
  target: number;
  /** The board: numbers still available (null = used up in a calculation). */
  slots: (number | null)[];
  /** Slot of the first operand. */
  selected: number | null;
  op: Op | null;
  moves: Move[];
  /** Closest value made so far (the starting numbers count too). */
  closest: number | null;
  hints: number;
  elapsedMs: number;
  /** The player has made a calculation (starting over then counts as abandoning). */
  touched: boolean;
}

export type Action =
  | { type: 'pick'; large: number; rng: Rng }
  | { type: 'tapSlot'; slot: number }
  | { type: 'tapOp'; op: Op }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'hint' }
  | { type: 'giveUp' }
  | { type: 'timeUp' };

export type GameEvent =
  | { kind: 'none' }
  | { kind: 'move'; slot: number }
  | { kind: 'invalid'; slot: number; reason: string }
  | { kind: 'hint'; message: string }
  | { kind: 'won' }
  | { kind: 'lost' };

const NONE: GameEvent = { kind: 'none' };

export function newGame(mode: NumbersMode, date?: string): NumbersGame {
  return {
    mode,
    ...(date ? { date } : {}),
    status: 'picking',
    large: 0,
    numbers: [],
    target: 0,
    slots: Array(SLOTS).fill(null),
    selected: null,
    op: null,
    moves: [],
    closest: null,
    hints: 0,
    elapsedMs: 0,
    touched: false,
  };
}

/**
 * Draw `large` numbers from the large deck and the rest from the small deck (two of each
 * 1–10), then a target from 101–999 that can be reached exactly. Rejection sampling keeps
 * targets spread like a plain random draw.
 */
export function deal(large: number, rng: Rng): { numbers: number[]; target: number } {
  const count = Math.max(0, Math.min(MAX_LARGE, Math.round(large)));
  for (;;) {
    const numbers = [...shuffle([...LARGE], rng).slice(0, count), ...shuffle([...SMALL, ...SMALL], rng).slice(0, SLOTS - count)];
    const can = reachable(numbers);
    const inRange = [...can].filter((v) => v >= TARGET_MIN && v <= TARGET_MAX).length;
    if (inRange < 20) continue; // practically never; redraw rather than give an impossible puzzle
    for (;;) {
      const target = TARGET_MIN + Math.floor(rng() * (TARGET_MAX - TARGET_MIN + 1));
      if (can.has(target)) return { numbers, target };
    }
  }
}

/** Start playing with the given numbers (used by `pick` and for the daily challenge). */
export function startWith(g: NumbersGame, large: number, numbers: number[], target: number): NumbersGame {
  return {
    ...g,
    status: 'playing',
    large,
    numbers,
    target,
    slots: [...numbers],
    selected: null,
    op: null,
    moves: [],
    closest: closestOf(numbers, target, null),
  };
}

function closestOf(values: (number | null)[], target: number, prev: number | null): number | null {
  let best = prev;
  for (const v of values) {
    if (v == null) continue;
    if (best == null || Math.abs(v - target) < Math.abs(best - target)) best = v;
  }
  return best;
}

export const distance = (g: NumbersGame) => (g.closest == null ? null : Math.abs(g.closest - g.target));

/** Show-style score for the closest value: 10 exact, 7 within 5, 5 within 10. */
export function points(g: NumbersGame): number {
  const d = distance(g);
  if (d == null) return 0;
  return d === 0 ? 10 : d <= 5 ? 7 : d <= 10 ? 5 : 0;
}

export const OP_SYMBOL: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };
export const OP_NAME: Record<Op, string> = { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' };

export const formatStep = (s: Step) => `${s.a} ${OP_SYMBOL[s.op]} ${s.b} = ${s.result}`;

/** Share of the work done, for the home screen's Continue card (closeness to the target). */
export function progress(g: NumbersGame): number {
  if (g.status === 'picking' || g.closest == null) return 0;
  const d = Math.abs(g.closest - g.target);
  return Math.max(0, 1 - d / g.target);
}

export function reduce(g: NumbersGame, action: Action): [NumbersGame, GameEvent] {
  if (action.type === 'pick') {
    if (g.status !== 'picking') return [g, NONE];
    const large = Math.max(0, Math.min(MAX_LARGE, Math.round(action.large)));
    const { numbers, target } = deal(large, action.rng);
    return [startWith(g, large, numbers, target), NONE];
  }
  if (g.status !== 'playing') return [g, NONE];

  switch (action.type) {
    case 'tapSlot': {
      const v = g.slots[action.slot];
      if (v == null) return [g, NONE];
      if (g.selected == null) return [{ ...g, selected: action.slot }, NONE];
      if (g.selected === action.slot) return [{ ...g, selected: null, op: null }, NONE];
      if (!g.op) return [{ ...g, selected: action.slot }, NONE];
      const x = g.slots[g.selected]!;
      const step = apply(x, g.op, v);
      if (!step) {
        const reason =
          g.op === '-' ? `${x} − ${v} would be zero` : `${Math.max(x, v)} can't be divided evenly by ${Math.min(x, v)}`;
        return [g, { kind: 'invalid', slot: action.slot, reason }];
      }
      const slots = [...g.slots];
      slots[g.selected] = null;
      slots[action.slot] = step.result;
      const next: NumbersGame = {
        ...g,
        slots,
        // Chain naturally: the result is selected for the next calculation.
        selected: action.slot,
        op: null,
        moves: [...g.moves, { ...step, before: g.slots }],
        closest: closestOf([step.result], g.target, g.closest),
        touched: true,
      };
      if (step.result === g.target) return [{ ...next, status: 'won', selected: null }, { kind: 'won' }];
      return [next, { kind: 'move', slot: action.slot }];
    }
    case 'tapOp':
      if (g.selected == null) return [g, NONE];
      return [{ ...g, op: g.op === action.op ? null : action.op }, NONE];
    case 'undo': {
      const last = g.moves[g.moves.length - 1];
      if (!last) return g.selected != null ? [{ ...g, selected: null, op: null }, NONE] : [g, NONE];
      return [{ ...g, slots: last.before, moves: g.moves.slice(0, -1), selected: null, op: null }, NONE];
    }
    case 'reset':
      if (!g.moves.length && g.selected == null) return [g, NONE];
      return [{ ...g, slots: [...g.numbers], moves: [], selected: null, op: null }, NONE];
    case 'hint': {
      const values = g.slots.filter((v): v is number => v != null);
      const sol = solve(values, g.target);
      const next = { ...g, hints: g.hints + 1, touched: true };
      if (!sol || !sol.exact) return [next, { kind: 'hint', message: "Can't reach the target from here. Try Undo." }];
      const s = sol.steps[0];
      return [next, { kind: 'hint', message: `Try ${s.a} ${OP_SYMBOL[s.op]} ${s.b}` }];
    }
    case 'giveUp':
    case 'timeUp':
      return [{ ...g, status: 'lost', selected: null, op: null }, { kind: 'lost' }];
  }
}

/** A way to reach the target from the numbers drawn (shown when the game is lost). */
export function solution(g: NumbersGame): Step[] {
  return solve(g.numbers, g.target)?.steps ?? [];
}
