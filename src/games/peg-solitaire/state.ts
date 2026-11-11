import { BOARDS, BoardId, legalJumps, solve } from './engine';

/**
 * Peg solitaire game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole PegGame object is persisted (games/game/peg-solitaire/save, schema v1), so changing
 * its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type PegMode = BoardId;
export type Jump = [number, number, number];

export const UNDO_LIMIT = 100;

export interface PegGame {
  mode: PegMode;
  /** true = peg, per hole of the board. */
  pegs: boolean[];
  /** The peg picked up (waiting for a hole to jump to). */
  selected: number | null;
  status: 'playing' | 'won';
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  history: Jump[];
}

export type Action =
  /** Tap a hole: pick up a peg, or jump the picked-up peg there. */
  | { type: 'tap'; hole: number }
  /** Drag a peg onto a hole. */
  | { type: 'jump'; from: number; to: number }
  | { type: 'undo' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  | { kind: 'selected'; hole: number | null }
  | { kind: 'invalid'; hole: number; reason: string }
  | { kind: 'jumped'; jump: Jump }
  | { kind: 'undone' }
  | { kind: 'hint'; jump: Jump | null }
  | { kind: 'won'; perfect: boolean };

export function newGame(mode: PegMode): PegGame {
  const b = BOARDS[mode];
  return {
    mode,
    pegs: b.holes.map((_, i) => i !== b.start),
    selected: null,
    status: 'playing',
    moves: 0,
    hints: 0,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
}

export const pegsLeft = (g: PegGame) => g.pegs.filter(Boolean).length;
export const progress = (g: PegGame) => 1 - (pegsLeft(g) - 1) / (g.pegs.length - 2);
export const jumps = (g: PegGame) => legalJumps(BOARDS[g.mode], g.pegs);
/** Holes the picked-up peg can jump to. */
export const targets = (g: PegGame) => (g.selected == null ? [] : jumps(g).filter(([f]) => f === g.selected).map(([, , t]) => t));
export const isStuck = (g: PegGame) => g.status === 'playing' && pegsLeft(g) > 1 && !jumps(g).length;
/** Ended on the centre hole (English board). */
export const isPerfect = (g: PegGame) => {
  const c = BOARDS[g.mode].center;
  return pegsLeft(g) === 1 && (c == null || g.pegs[c]);
};

function apply(g: PegGame, j: Jump): [PegGame, Event] {
  const pegs = g.pegs.slice();
  pegs[j[0]] = pegs[j[1]] = false;
  pegs[j[2]] = true;
  const next: PegGame = { ...g, pegs, selected: null, moves: g.moves + 1, touched: true, history: [...g.history, j].slice(-UNDO_LIMIT) };
  if (pegs.filter(Boolean).length === 1) {
    const won = { ...next, status: 'won' as const };
    return [won, { kind: 'won', perfect: isPerfect(won) }];
  }
  return [next, { kind: 'jumped', jump: j }];
}

function tryJump(g: PegGame, from: number, to: number): [PegGame, Event] {
  const j = jumps(g).find(([f, , t]) => f === from && t === to);
  if (!j) return [g, { kind: 'invalid', hole: to, reason: 'A peg jumps over one neighbouring peg into the empty hole behind it' }];
  return apply(g, j);
}

export function reduce(g: PegGame, action: Action): [PegGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'tap': {
      const h = action.hole;
      if (g.pegs[h]) {
        const selected = g.selected === h ? null : h;
        return [{ ...g, selected }, { kind: 'selected', hole: selected }];
      }
      if (g.selected == null) return [g, { kind: 'invalid', hole: h, reason: 'Tap a peg first, then the hole to jump to' }];
      return tryJump(g, g.selected, h);
    }
    case 'jump':
      return tryJump(g, action.from, action.to);
    case 'undo': {
      const j = g.history[g.history.length - 1];
      if (!j) return [g, { kind: 'none' }];
      const pegs = g.pegs.slice();
      pegs[j[0]] = pegs[j[1]] = true;
      pegs[j[2]] = false;
      return [{ ...g, pegs, selected: null, history: g.history.slice(0, -1), undos: g.undos + 1, touched: true }, { kind: 'undone' }];
    }
    case 'hint': {
      const path = solve(BOARDS[g.mode], g.pegs, 200000);
      const jump = path?.[0] ?? null;
      return [{ ...g, hints: g.hints + 1, touched: true, selected: jump ? jump[0] : g.selected }, { kind: 'hint', jump }];
    }
  }
}
