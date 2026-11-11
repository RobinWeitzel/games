/**
 * Logic-only Minesweeper solver, used to make every board solvable without guessing.
 *
 * It plays like a careful human: it only opens cells it can prove safe and only flags cells it
 * can prove are mines, using (in order of cost)
 *   1. single numbers   (a 2 with two hidden neighbours: both mines),
 *   2. pairs of numbers (one number's hidden cells contain another's: the difference is known),
 *   3. the mine counter (no mines left: everything hidden is safe),
 *   4. every arrangement of mines along the edge of the open area that fits all the numbers
 *      (a cell that is safe, or a mine, in all of them is decided).
 * A board is "no-guess" if this solver opens every safe cell from the starting cell.
 */

export interface Layout {
  cols: number;
  rows: number;
  /** 1 = mine, per cell. */
  mines: ArrayLike<number>;
}

interface Grid {
  size: number;
  mineTotal: number;
  nb: number[][];
  /** Mines around each cell. */
  num: number[];
  mine: ArrayLike<number>;
}

/** Search budget for step 4 per edge group, so a solve always stays fast (bigger groups count as unsolved). */
const MAX_GROUP = 40;
const MAX_NODES = 20000;

function grid(l: Layout): Grid {
  const size = l.cols * l.rows;
  const nb: number[][] = [];
  const num: number[] = [];
  let mineTotal = 0;
  for (let i = 0; i < size; i++) {
    const r = Math.floor(i / l.cols);
    const c = i % l.cols;
    const ns: number[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < l.rows && cc >= 0 && cc < l.cols) ns.push(rr * l.cols + cc);
      }
    nb.push(ns);
    num.push(ns.reduce((n, j) => n + (l.mines[j] ? 1 : 0), 0));
    if (l.mines[i]) mineTotal++;
  }
  return { size, mineTotal, nb, num, mine: l.mines };
}

interface Constraint {
  cells: number[];
  /** Mines among `cells`. */
  n: number;
}

/**
 * One round of deductions from what's open and what's known to be a mine.
 * Returns cells proven safe and cells proven to be mines (both empty when stuck).
 */
function deduce(G: Grid, open: Uint8Array, known: Uint8Array): { safe: number[]; mines: number[] } {
  const cons: Constraint[] = [];
  for (let c = 0; c < G.size; c++) {
    if (!open[c] || !G.num[c]) continue;
    const cells: number[] = [];
    let k = 0;
    for (const n of G.nb[c]) {
      if (known[n]) k++;
      else if (!open[n]) cells.push(n);
    }
    if (cells.length) cons.push({ cells, n: G.num[c] - k });
  }

  // 1. Single numbers.
  const safe = new Set<number>();
  const mines = new Set<number>();
  for (const k of cons) {
    if (k.n === 0) k.cells.forEach((c) => safe.add(c));
    else if (k.n === k.cells.length) k.cells.forEach((c) => mines.add(c));
  }
  if (safe.size || mines.size) return { safe: [...safe], mines: [...mines] };

  // 2. Pairs: A's cells are a subset of B's, so B \ A holds exactly B.n - A.n mines.
  const byCell = new Map<number, Constraint[]>();
  for (const k of cons) for (const c of k.cells) (byCell.get(c) ?? byCell.set(c, []).get(c)!).push(k);
  for (const a of cons) {
    for (const b of byCell.get(a.cells[0])!) {
      if (b === a || b.cells.length <= a.cells.length || !a.cells.every((c) => b.cells.includes(c))) continue;
      const diff = b.cells.filter((c) => !a.cells.includes(c));
      const m = b.n - a.n;
      if (m === 0) diff.forEach((c) => safe.add(c));
      else if (m === diff.length) diff.forEach((c) => mines.add(c));
    }
  }
  if (safe.size || mines.size) return { safe: [...safe], mines: [...mines] };

  // 3. The mine counter.
  const hidden: number[] = [];
  let knownCount = 0;
  for (let c = 0; c < G.size; c++) {
    if (known[c]) knownCount++;
    else if (!open[c]) hidden.push(c);
  }
  const remaining = G.mineTotal - knownCount;
  if (remaining === 0) return { safe: hidden, mines: [] };
  if (remaining === hidden.length) return { safe: [], mines: hidden };

  // 4. All arrangements along the edge, one connected group at a time.
  for (const group of groups(cons)) {
    const r = enumerate(group, remaining);
    if (!r) continue;
    r.cells.forEach((c, i) => {
      if (r.mineIn[i] === 0) safe.add(c);
      else if (r.mineIn[i] === r.solutions) mines.add(c);
    });
    if (safe.size || mines.size) return { safe: [...safe], mines: [...mines] };
  }
  return { safe: [], mines: [] };
}

/** Constraints that share cells, grouped (they have to be solved together). */
function groups(cons: Constraint[]): Constraint[][] {
  const parent = cons.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map<number, number>();
  cons.forEach((k, i) =>
    k.cells.forEach((c) => {
      const o = owner.get(c);
      if (o == null) owner.set(c, i);
      else parent[find(o)] = find(i);
    }),
  );
  const out = new Map<number, Constraint[]>();
  cons.forEach((k, i) => (out.get(find(i)) ?? out.set(find(i), []).get(find(i))!).push(k));
  return [...out.values()];
}

/** Count, per cell, in how many valid mine arrangements it is a mine. null: group too big. */
function enumerate(group: Constraint[], maxMines: number): { cells: number[]; mineIn: number[]; solutions: number } | null {
  // Order cells constraint by constraint so partial assignments are checked early.
  const index = new Map<number, number>();
  const cells: number[] = [];
  for (const k of group) for (const c of k.cells) if (!index.has(c)) index.set(c, cells.push(c) - 1);
  if (cells.length > MAX_GROUP) return null;
  const cellCons = cells.map(() => [] as number[]);
  group.forEach((k, ki) => k.cells.forEach((c) => cellCons[index.get(c)!].push(ki)));
  const need = group.map((k) => k.n);
  const left = group.map((k) => k.cells.length);
  const assign = new Array(cells.length).fill(0);
  const mineIn = new Array(cells.length).fill(0);
  let solutions = 0;
  let nodes = 0;
  let used = 0;

  const rec = (i: number): boolean => {
    if (++nodes > MAX_NODES) return false;
    if (i === cells.length) {
      solutions++;
      for (let j = 0; j < cells.length; j++) mineIn[j] += assign[j];
      return true;
    }
    for (const v of [0, 1]) {
      if (v && used >= maxMines) continue;
      let ok = true;
      for (const ki of cellCons[i]) {
        left[ki]--;
        need[ki] -= v;
        if (need[ki] < 0 || need[ki] > left[ki]) ok = false;
      }
      assign[i] = v;
      used += v;
      if (ok && !rec(i + 1)) return false;
      used -= v;
      for (const ki of cellCons[i]) {
        left[ki]++;
        need[ki] += v;
      }
    }
    return true;
  };
  if (!rec(0) || !solutions) return null;
  return { cells, mineIn, solutions };
}

/** Open a cell, and everything around it while it's a 0. */
function flood(G: Grid, open: Uint8Array, start: number): void {
  const stack = [start];
  while (stack.length) {
    const c = stack.pop()!;
    if (open[c] || G.mine[c]) continue;
    open[c] = 1;
    if (!G.num[c]) for (const n of G.nb[c]) if (!open[n]) stack.push(n);
  }
}

/** Can the board be cleared from `start` (opened first) by logic alone? */
export function isSolvable(l: Layout, start: number): boolean {
  const G = grid(l);
  const open = new Uint8Array(G.size);
  const known = new Uint8Array(G.size);
  flood(G, open, start);
  const safeTotal = G.size - G.mineTotal;
  for (;;) {
    let opened = 0;
    for (let c = 0; c < G.size; c++) opened += open[c];
    if (opened === safeTotal) return true;
    const d = deduce(G, open, known);
    if (!d.safe.length && !d.mines.length) return false;
    for (const m of d.mines) known[m] = 1;
    for (const s of d.safe) flood(G, open, s);
  }
}

/**
 * Hidden cells that can be proven safe right now from the open cells (the player's flags are
 * ignored: they may be wrong). Used for hints, so a hint shows the next logical step.
 */
export function provablySafe(l: Layout, opened: ArrayLike<boolean | number>): number[] {
  const G = grid(l);
  const open = Uint8Array.from({ length: G.size }, (_, i) => (opened[i] ? 1 : 0));
  const known = new Uint8Array(G.size);
  // Mines proven along the way count as known (a human would flag them in their head).
  for (let round = 0; round < 50; round++) {
    const d = deduce(G, open, known);
    if (d.safe.length) return d.safe;
    if (!d.mines.length) return [];
    for (const m of d.mines) known[m] = 1;
  }
  return [];
}
