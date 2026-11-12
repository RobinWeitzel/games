import { rankOf, suitOf } from '../../core/cards';
import type { Rng } from '../../core/random';
import { COLUMNS, Move, RUNS, SUIT_COUNT, SpiderGame, SpiderMode, applyDeal, applyMove, canPickUp, newGame } from './state';

/**
 * A best-first search that plays a Spider deal knowing every card, face down or not. It's used to
 * make sure a deal can be won before it's handed out (1 Suit and the daily), never for hints: a
 * hint must not give away face-down cards.
 *
 * With one suit, cards of the same rank are interchangeable, so positions are compared by rank
 * only. That's what makes the search fast enough.
 */

const follows = (lower: number, upper: number) => suitOf(lower) === suitOf(upper) && rankOf(lower) === rankOf(upper) + 1;

/** Same position, whichever copy of a card is where. Columns are sorted: their order doesn't matter. */
function keyOf(g: SpiderGame): string {
  const cols = g.tableau.map((c, i) => `${g.faceDown[i]}:${c.map((x) => x % 52).join(',')}`);
  return `${g.stock.length}|${cols.sort().join('|')}`;
}

/** Lower is closer to winning: runs still to build, face-down cards, cards on a card they don't follow. */
function distance(g: SpiderGame): number {
  let breaks = 0;
  let down = 0;
  let empty = 0;
  for (let i = 0; i < COLUMNS; i++) {
    const c = g.tableau[i];
    down += g.faceDown[i];
    if (!c.length) empty++;
    for (let k = Math.max(1, g.faceDown[i] + 1); k < c.length; k++) if (!follows(c[k - 1], c[k])) breaks++;
  }
  // Weights tuned on random 1-suit deals: proves ~92% of them within the default budget (~20ms each).
  return 40 * (RUNS - g.done.length) + 4 * down + 3 * breaks + 3 * g.stock.length - 3 * empty;
}

/** Moves worth trying: a run onto the card it follows (or any card one higher), runs into an empty column, a deal. */
function solverMoves(g: SpiderGame): Move[] {
  const out: Move[] = [];
  const firstEmpty = g.tableau.findIndex((c) => !c.length);
  for (let i = 0; i < COLUMNS; i++) {
    const col = g.tableau[i];
    if (!col.length) continue;
    // The longest run on top of the column.
    let start = col.length - 1;
    while (start > g.faceDown[i] && canPickUp(g, `t${i}`, start - 1)) start--;
    for (let j = 0; j < COLUMNS; j++) {
      if (i === j) continue;
      const target = g.tableau[j];
      if (target.length) {
        const top = target[target.length - 1];
        const index = col.length - 1 - (rankOf(top) - 1 - rankOf(col[col.length - 1]));
        if (index < start || index >= col.length) continue;
        // Moving a card off the card it follows never helps (it already is in suit).
        if (index > g.faceDown[i] && follows(col[index - 1], col[index])) continue;
        out.push({ from: `t${i}`, index, to: `t${j}` });
      } else if (j === firstEmpty && start > 0) {
        // Into an empty column: the whole run, or the run minus its bottom card (to split it).
        out.push({ from: `t${i}`, index: start, to: `t${j}` });
        if (start + 1 < col.length) out.push({ from: `t${i}`, index: start + 1, to: `t${j}` });
      }
    }
  }
  return out;
}

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

/** A step of a solution: a move, or 'deal'. */
export type Step = Move | 'deal';

/** A way to win from `start` (knowing every card), or null if none was found within `budget` positions. */
export function solve(start: SpiderGame, budget = 4000): Step[] | null {
  interface Node {
    g: SpiderGame;
    parent: Node | null;
    step: Step | null;
  }
  const seen = new Set<string>([keyOf(start)]);
  const open = new Heap<Node>();
  open.push(0, { g: start, parent: null, step: null });
  let nodes = 0;
  const add = (parent: Node, g: SpiderGame, step: Step) => {
    const key = keyOf(g);
    if (seen.has(key)) return;
    seen.add(key);
    open.push(distance(g), { g, parent, step });
  };
  while (open.size) {
    const node = open.pop();
    if (node.g.done.length === RUNS) {
      const path: Step[] = [];
      for (let n: Node | null = node; n?.step; n = n.parent) path.unshift(n.step);
      return path;
    }
    if (++nodes > budget) return null;
    const moves = solverMoves(node.g);
    for (const m of moves) add(node, applyMove(node.g, m, false), m);
    if (node.g.stock.length && node.g.tableau.every((c) => c.length)) add(node, applyDeal(node.g, false), 'deal');
  }
  return null;
}

/**
 * The solver proves ~92% of random 1-suit deals winnable within its budget, so a new game rarely
 * needs a second try. After MAX_TRIES the deal is kept as it is.
 */
const MAX_TRIES = 15;

/**
 * A new deal. With one suit (1 Suit and the daily) it's one the solver has won, so it can be won.
 * Deals with two and four suits are random: the solver isn't strong enough to prove them.
 */
export function newWinnableGame(mode: SpiderMode, rng: Rng, date?: string): SpiderGame {
  let g = newGame(mode, rng, date);
  if (SUIT_COUNT[mode] !== 1) return g;
  for (let i = 0; i < MAX_TRIES && !solve(g); i++) g = newGame(mode, rng, date);
  return g;
}
