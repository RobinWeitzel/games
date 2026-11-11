import type { Rng } from '../../core/random';
import { Card, isRed, rankOf, shuffledDeck, suitOf } from '../../core/cards';

/**
 * FreeCell game logic: pure functions only (no storage, no UI), unit-tested in state.test.ts.
 *
 * The whole FreeCellGame object is persisted (games/game/freecell/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type FreeCellMode = 'classic' | 'daily';

/** A pile: column 't0'…'t7', free cell 'c0'…'c3', foundation 'f0'…'f3' (one per suit, in suit order). */
export type Pile = `t${number}` | `c${number}` | `f${number}`;

export const COLUMNS = 8;
export const CELLS = 4;

/** Cards that went from `from` to `to` in one go (a run moved with the free cells counts as one). */
export interface Step {
  from: Pile;
  to: Pile;
  n: number;
}

export interface FreeCellGame {
  mode: FreeCellMode;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  /** Eight columns, bottom first. Every card is face up. */
  tableau: Card[][];
  /** The four free cells. */
  cells: (Card | null)[];
  /** Cards on each suit's foundation (0–13), so the top card is suit * 13 + count - 1. */
  foundations: number[];
  status: 'playing' | 'won';
  moves: number;
  hints: number;
  undos: number;
  elapsedMs: number;
  /** The player made a move (an untouched game isn't counted when abandoned). */
  touched: boolean;
  /** One entry per player move: the move and the cards that then went home by themselves. Most recent last. */
  history: Step[][];
}

export const UNDO_LIMIT = 500;

/** A move: `index` is the position in the source pile of the first card moved. */
export interface Move {
  from: Pile;
  index: number;
  to: Pile;
}

export type Action =
  /** Tap a card: move it (and the cards on it) to the best place it can go. */
  | { type: 'tap'; pile: Pile; index: number }
  /** Drag a card (and the cards on it) onto a pile. */
  | { type: 'move'; from: Pile; index: number; to: Pile }
  | { type: 'undo' }
  | { type: 'hint' };

export type Event =
  | { kind: 'none' }
  /** The card has nowhere to go. `reason` says why, for the status line. */
  | { kind: 'invalid'; pile: Pile; index: number; reason: string }
  /** `steps`: the move and the cards that went home by themselves after it. */
  | { kind: 'moved'; steps: Step[]; suitDone: boolean }
  | { kind: 'undone' }
  | { kind: 'hint'; move: Move | null }
  | { kind: 'won' };

const kind = (p: Pile) => p[0] as 't' | 'c' | 'f';
const num = (p: Pile) => Number(p.slice(1));

// ---------- Dealing ----------

/** The classic deal: the deck dealt left to right in rows, so columns 1–4 get 7 cards and 5–8 get 6. */
export function deal(mode: FreeCellMode, deck: Card[], date?: string): FreeCellGame {
  const tableau: Card[][] = Array.from({ length: COLUMNS }, () => []);
  deck.forEach((c, i) => tableau[i % COLUMNS].push(c));
  const g: FreeCellGame = {
    mode,
    ...(date ? { date } : {}),
    tableau,
    cells: Array(CELLS).fill(null),
    foundations: [0, 0, 0, 0],
    status: 'playing',
    moves: 0,
    hints: 0,
    undos: 0,
    elapsedMs: 0,
    touched: false,
    history: [],
  };
  // Aces (and twos after them) on top of a column go home right away, as after every move.
  autoHome(g);
  return g;
}

/**
 * The solver proves ~93% of random deals winnable within its budget (almost all FreeCell deals
 * are), so a new game rarely needs a second try. After MAX_TRIES the deal is kept as it is.
 */
const MAX_TRIES = 10;

/** A new deal that the solver has won, so every game can be won. */
export function newGame(mode: FreeCellMode, rng: Rng, date?: string): FreeCellGame {
  let g = deal(mode, shuffledDeck(rng), date);
  for (let i = 0; i < MAX_TRIES && !solve(g); i++) g = deal(mode, shuffledDeck(rng), date);
  return g;
}

// ---------- Reading the board ----------

export const foundationCount = (g: FreeCellGame) => g.foundations.reduce((a, b) => a + b, 0);
export const progress = (g: FreeCellGame) => foundationCount(g) / 52;

/** The cards in a pile, bottom first. */
export function pileCards(g: FreeCellGame, p: Pile): Card[] {
  const i = num(p);
  if (kind(p) === 'f') return Array.from({ length: g.foundations[i] }, (_, k) => i * 13 + k);
  if (kind(p) === 'c') return g.cells[i] == null ? [] : [g.cells[i]!];
  return g.tableau[i];
}

/** Can `upper` sit on `lower` in a column (one lower, other colour)? */
const fits = (lower: Card, upper: Card) => isRed(lower) !== isRed(upper) && rankOf(lower) === rankOf(upper) + 1;

/** Is the column ordered from `index` to the top (descending, alternating colours)? */
export function isRun(col: Card[], index: number): boolean {
  for (let k = index + 1; k < col.length; k++) if (!fits(col[k - 1], col[k])) return false;
  return index >= 0 && index < col.length;
}

export const freeCells = (g: FreeCellGame) => g.cells.filter((c) => c == null).length;
const emptyColumns = (g: FreeCellGame, except?: Pile) => g.tableau.filter((c, i) => !c.length && `t${i}` !== except).length;

/**
 * How many cards can move at once onto `to`: one per free cell plus one, doubled for every
 * empty column that isn't the destination (the cards are moved one by one through them).
 */
export const maxRun = (g: FreeCellGame, to?: Pile) => (freeCells(g) + 1) * 2 ** emptyColumns(g, to);

/** Can the cards from `index` up be picked up (dragged)? */
export function canPickUp(g: FreeCellGame, p: Pile, index: number): boolean {
  const cards = pileCards(g, p);
  if (index < 0 || index >= cards.length) return false;
  if (kind(p) !== 't') return index === cards.length - 1;
  return isRun(cards, index) && cards.length - index <= maxRun(g);
}

/** Why the cards from `index` up can't go onto `to` (null: they can). */
export function whyNot(g: FreeCellGame, m: Move): string | null {
  const cards = pileCards(g, m.from);
  if (m.from === m.to || m.index < 0 || m.index >= cards.length) return 'That card can’t go there';
  const n = cards.length - m.index;
  const card = cards[m.index];
  if (kind(m.from) === 't' && !isRun(cards, m.index)) return 'Only an ordered run can move together';
  if (kind(m.from) !== 't' && n !== 1) return 'That card can’t go there';
  const i = num(m.to);
  switch (kind(m.to)) {
    case 'f':
      return n === 1 && suitOf(card) === i && g.foundations[i] === rankOf(card) - 1 ? null : 'That card can’t go home yet';
    case 'c':
      return n === 1 && g.cells[i] == null ? null : n > 1 ? 'A free cell holds one card' : 'That free cell is taken';
    case 't': {
      const col = g.tableau[i];
      if (col.length && !fits(col[col.length - 1], card)) return 'That card can’t go there';
      const max = maxRun(g, m.to);
      if (n > max) return `Only ${max} card${max === 1 ? '' : 's'} can move at once · free more cells or columns`;
      return null;
    }
  }
}

export const isLegal = (g: FreeCellGame, m: Move) => whyNot(g, m) == null;

/** Every column is in order from bottom to top, so all cards can simply go home. */
export function canAutoFinish(g: FreeCellGame): boolean {
  return g.status === 'playing' && g.tableau.every((col) => col.every((c, k) => k === 0 || rankOf(col[k - 1]) >= rankOf(c)));
}

/** The next card to put home when finishing automatically: the lowest one that can go. */
export function autoFinishMove(g: FreeCellGame): Move | null {
  let best: Move | null = null;
  let bestRank = 99;
  const consider = (p: Pile) => {
    const cards = pileCards(g, p);
    if (!cards.length) return;
    const c = cards[cards.length - 1];
    const m: Move = { from: p, index: cards.length - 1, to: `f${suitOf(c)}` };
    if (rankOf(c) < bestRank && isLegal(g, m)) {
      best = m;
      bestRank = rankOf(c);
    }
  };
  for (let i = 0; i < CELLS; i++) consider(`c${i}`);
  for (let i = 0; i < COLUMNS; i++) consider(`t${i}`);
  return best;
}

// ---------- Changing the board ----------

const clone = (g: FreeCellGame): FreeCellGame => ({
  ...g,
  tableau: g.tableau.map((c) => c.slice()),
  cells: g.cells.slice(),
  foundations: g.foundations.slice(),
});

/** Move `n` cards (mutates `g`, which must be a clone). */
function shift(g: FreeCellGame, from: Pile, to: Pile, n: number): void {
  let cards: Card[];
  const i = num(from);
  if (kind(from) === 'f') {
    g.foundations[i] -= n;
    cards = [i * 13 + g.foundations[i]];
  } else if (kind(from) === 'c') {
    cards = [g.cells[i]!];
    g.cells[i] = null;
  } else {
    cards = g.tableau[i].splice(g.tableau[i].length - n, n);
  }
  const j = num(to);
  if (kind(to) === 'f') g.foundations[j] += cards.length;
  else if (kind(to) === 'c') g.cells[j] = cards[0];
  else g.tableau[j].push(...cards);
}

/**
 * A card that can go home without ever being needed in a column again: aces and twos, or when
 * both foundations of the other colour are at most one rank lower.
 */
function safeHome(g: FreeCellGame, c: Card): boolean {
  const r = rankOf(c);
  if (g.foundations[suitOf(c)] !== r - 1) return false;
  if (r <= 2) return true;
  const other = isRed(c) ? [0, 3] : [1, 2];
  return other.every((s) => g.foundations[s] >= r - 1);
}

/** Put every safe card home (mutates `g`). Returns the steps, in order. */
function autoHome(g: FreeCellGame): Step[] {
  const steps: Step[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    const piles: Pile[] = [...g.cells.map((_, i) => `c${i}` as Pile), ...g.tableau.map((_, i) => `t${i}` as Pile)];
    for (const p of piles) {
      const cards = pileCards(g, p);
      const c = cards[cards.length - 1];
      if (c == null || !safeHome(g, c)) continue;
      const to: Pile = `f${suitOf(c)}`;
      shift(g, p, to, 1);
      steps.push({ from: p, to, n: 1 });
      changed = true;
    }
  }
  return steps;
}

/** Apply a legal move and let the safe cards go home. */
function applyMove(g: FreeCellGame, m: Move, record = true): [FreeCellGame, Step[]] {
  const next = clone(g);
  const n = pileCards(g, m.from).length - m.index;
  shift(next, m.from, m.to, n);
  const steps = [{ from: m.from, to: m.to, n }, ...autoHome(next)];
  next.moves++;
  next.touched = true;
  if (record) next.history = [...g.history, steps].slice(-UNDO_LIMIT);
  if (foundationCount(next) === 52) next.status = 'won';
  return [next, steps];
}

function undo(g: FreeCellGame): FreeCellGame {
  const steps = g.history[g.history.length - 1];
  if (!steps) return g;
  const next = clone(g);
  for (let k = steps.length - 1; k >= 0; k--) shift(next, steps[k].to, steps[k].from, steps[k].n);
  next.history = g.history.slice(0, -1);
  next.undos++;
  next.touched = true;
  return next;
}

/**
 * Where a tapped card goes: home, onto a column it fits, an empty column (a run as long as
 * possible from there), else a free cell. A card in a free cell never goes to another free cell.
 */
export function bestTarget(g: FreeCellGame, from: Pile, index: number): Pile | null {
  const cards = pileCards(g, from);
  const card = cards[index];
  if (card == null) return null;
  const n = cards.length - index;
  const ok = (to: Pile) => to !== from && isLegal(g, { from, index, to });
  if (n === 1 && kind(from) !== 'f' && ok(`f${suitOf(card)}`)) return `f${suitOf(card)}`;
  const start = kind(from) === 't' ? num(from) + 1 : 0;
  let empty: Pile | null = null;
  for (let k = 0; k < COLUMNS; k++) {
    const i = (start + k) % COLUMNS;
    const to: Pile = `t${i}`;
    if (!ok(to)) continue;
    if (g.tableau[i].length) return to;
    // A run already at the bottom of its column doesn't move to another empty column.
    if (!empty && !(kind(from) === 't' && index === 0)) empty = to;
  }
  if (empty) return empty;
  if (n === 1 && kind(from) === 't') {
    const cell = g.cells.indexOf(null);
    if (cell >= 0) return `c${cell}`;
  }
  return null;
}

/** Any move that changes something (not just moving a card between free cells). */
export function hasMove(g: FreeCellGame): boolean {
  if (g.status !== 'playing') return false;
  for (const from of allPiles()) {
    const cards = pileCards(g, from);
    if (!cards.length || kind(from) === 'f') continue;
    for (const to of allPiles()) {
      if (kind(from) === 'c' && kind(to) === 'c') continue;
      if (to !== from && isLegal(g, { from, index: cards.length - 1, to })) return true;
    }
  }
  return false;
}

const allPiles = (): Pile[] => [
  ...Array.from({ length: COLUMNS }, (_, i) => `t${i}` as Pile),
  ...Array.from({ length: CELLS }, (_, i) => `c${i}` as Pile),
  ...Array.from({ length: 4 }, (_, i) => `f${i}` as Pile),
];

/** Nothing can move any more (the player can still undo or start over). */
export const isStuck = (g: FreeCellGame) => g.status === 'playing' && !hasMove(g);

// ---------- Solver ----------

/** The same position, whatever order the free cells and columns are in. */
const keyOf = (g: FreeCellGame) =>
  `${g.cells
    .map((c) => c ?? -1)
    .sort((a, b) => a - b)
    .join(',')}|${g.tableau
    .map((c) => c.join(','))
    .sort()
    .join('|')}`;

/** Lower is closer to solved: cards not home, cards buried above the next card of each suit, disorder, full cells. */
function distance(g: FreeCellGame): number {
  let buried = 0;
  let disorder = 0;
  let empty = 0;
  for (const col of g.tableau) {
    if (!col.length) empty++;
    for (let k = 0; k < col.length; k++) {
      const c = col[k];
      if (g.foundations[suitOf(c)] === rankOf(c) - 1) buried += col.length - 1 - k;
    }
    // A card sitting on a card that it doesn't belong on.
    for (let k = 1; k < col.length; k++) if (!fits(col[k - 1], col[k])) disorder++;
  }
  // Weights tuned on random deals: proves ~93% of them within the default budget (~20ms each).
  return 3 * (52 - foundationCount(g)) + buried + disorder + 2 * (CELLS - freeCells(g)) - 3 * empty;
}

/** Candidate moves for the solver (and hints), most promising first. */
function solverMoves(g: FreeCellGame): Move[] {
  const out: Move[] = [];
  const cellsFree = freeCells(g);
  const firstFreeCell = g.cells.indexOf(null);
  // Home.
  for (const p of allPiles()) {
    if (kind(p) === 'f') continue;
    const cards = pileCards(g, p);
    const c = cards[cards.length - 1];
    if (c != null && g.foundations[suitOf(c)] === rankOf(c) - 1) out.push({ from: p, index: cards.length - 1, to: `f${suitOf(c)}` });
  }
  const firstEmpty = g.tableau.findIndex((c) => !c.length);
  // Columns and free cells onto columns.
  for (let i = 0; i < COLUMNS; i++) {
    const col = g.tableau[i];
    for (let j = 0; j < COLUMNS; j++) {
      if (i === j || !col.length) continue;
      const target = g.tableau[j];
      if (target.length) {
        // Exactly one card of the run can go onto a non-empty column.
        const want = rankOf(target[target.length - 1]) - 1;
        const index = col.length - 1 - (want - rankOf(col[col.length - 1]));
        if (index >= 0 && index < col.length && isLegal(g, { from: `t${i}`, index, to: `t${j}` })) out.push({ from: `t${i}`, index, to: `t${j}` });
      } else if (j === firstEmpty) {
        // Into an empty column: the longest run that can go, unless that is the whole column.
        let index = col.length - 1;
        while (index > 0 && fits(col[index - 1], col[index]) && col.length - index < maxRun(g, `t${j}`)) index--;
        if (index > 0) out.push({ from: `t${i}`, index, to: `t${j}` });
      }
    }
  }
  for (let c = 0; c < CELLS; c++) {
    if (g.cells[c] == null) continue;
    for (let j = 0; j < COLUMNS; j++) {
      if (g.tableau[j].length ? isLegal(g, { from: `c${c}`, index: 0, to: `t${j}` }) : j === firstEmpty) out.push({ from: `c${c}`, index: 0, to: `t${j}` });
    }
  }
  // Column tops into a free cell.
  if (cellsFree) for (let i = 0; i < COLUMNS; i++) if (g.tableau[i].length) out.push({ from: `t${i}`, index: g.tableau[i].length - 1, to: `c${firstFreeCell}` });
  return out;
}

/** A tiny binary heap of [priority, value]. */
class Heap<T> {
  private items: [number, T][] = [];
  get size() {
    return this.items.length;
  }
  push(p: number, v: T) {
    const a = this.items;
    a.push([p, v]);
    for (let i = a.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (a[parent][0] <= a[i][0]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop(): T {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
}

/**
 * Best-first search for a way to win. Returns the moves (each followed by the automatic moves
 * home, as in the game) or null if none was found within `budget` positions.
 */
export function solve(start: FreeCellGame, budget = 3000): Move[] | null {
  interface Node {
    g: FreeCellGame;
    parent: Node | null;
    move: Move | null;
  }
  const first = clone(start);
  autoHome(first);
  const seen = new Set<string>([keyOf(first)]);
  const open = new Heap<Node>();
  open.push(0, { g: first, parent: null, move: null });
  let nodes = 0;
  while (open.size) {
    const node = open.pop();
    if (foundationCount(node.g) === 52 || canAutoFinish(node.g)) {
      const path: Move[] = [];
      for (let n: Node | null = node; n?.move; n = n.parent) path.unshift(n.move);
      return path;
    }
    if (++nodes > budget) return null;
    for (const m of solverMoves(node.g)) {
      const [next] = applyMove(node.g, m, false);
      const key = keyOf(next);
      if (seen.has(key)) continue;
      seen.add(key);
      open.push(distance(next), { g: next, parent: node, move: m });
    }
  }
  return null;
}

/** A good next move: the first move of a found solution, else the most promising move (null when stuck). */
export function hintMove(g: FreeCellGame, budget = 3000): Move | null {
  if (g.status !== 'playing') return null;
  // The solver starts after the safe moves home, which the game has already made.
  const path = solve(g, budget);
  if (path?.length) return path[0];
  const moves = solverMoves(g).filter((m) => !(kind(m.from) === 'c' && kind(m.to) === 'c'));
  return moves[0] ?? null;
}

// ---------- Reducer ----------

/** Apply an action. Returns the same object when nothing changed. */
export function reduce(g: FreeCellGame, action: Action): [FreeCellGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  switch (action.type) {
    case 'tap': {
      const cards = pileCards(g, action.pile);
      if (action.index < 0 || action.index >= cards.length || kind(action.pile) === 'f') return [g, { kind: 'none' }];
      if (kind(action.pile) === 't' && !isRun(cards, action.index)) {
        return [g, { kind: 'invalid', pile: action.pile, index: action.index, reason: 'Only an ordered run can move together' }];
      }
      const to = bestTarget(g, action.pile, action.index);
      if (!to) {
        const n = cards.length - action.index;
        const reason = n > maxRun(g) ? `Only ${maxRun(g)} card${maxRun(g) === 1 ? '' : 's'} can move at once` : 'That card has nowhere to go';
        return [g, { kind: 'invalid', pile: action.pile, index: action.index, reason }];
      }
      return moveEvent(g, { from: action.pile, index: action.index, to });
    }
    case 'move': {
      let to = action.to;
      const card = pileCards(g, action.from)[action.index];
      // Forgiving drops: any foundation means the card's own, a taken free cell means a free one.
      if (kind(to) === 'f' && card != null) to = `f${suitOf(card)}`;
      if (kind(to) === 'c' && g.cells[num(to)] != null && g.cells.includes(null)) to = `c${g.cells.indexOf(null)}`;
      const m = { from: action.from, index: action.index, to };
      const reason = whyNot(g, m);
      if (reason) return [g, { kind: 'invalid', pile: action.from, index: action.index, reason }];
      return moveEvent(g, m);
    }
    case 'undo':
      if (!g.history.length) return [g, { kind: 'none' }];
      return [undo(g), { kind: 'undone' }];
    case 'hint':
      return [{ ...g, hints: g.hints + 1, touched: true }, { kind: 'hint', move: hintMove(g) }];
  }
}

function moveEvent(g: FreeCellGame, m: Move): [FreeCellGame, Event] {
  const [next, steps] = applyMove(g, m);
  if (next.status === 'won') return [next, { kind: 'won' }];
  const suitDone = steps.some((s) => kind(s.to) === 'f' && next.foundations[num(s.to)] === 13);
  return [next, { kind: 'moved', steps, suitDone }];
}
