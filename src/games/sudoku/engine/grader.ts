import {
  BOXES,
  COLS,
  Grid,
  PEERS,
  ROWS,
  UNITS,
  bit,
  boxOf,
  candidatesFor,
  colOf,
  popcount,
  rowOf,
  sees,
} from './board';

/**
 * Human-style solver used to grade puzzles by the hardest technique they need.
 *
 * Level 1: naked single, hidden single
 * Level 2: pointing / box-line reduction, naked pair, hidden pair
 * Level 3: naked/hidden triple, X-Wing, Swordfish, XY-Wing
 * Level 4: not solvable with the techniques above
 */
export type Technique =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'intersection'
  | 'nakedPair'
  | 'hiddenPair'
  | 'nakedTriple'
  | 'hiddenTriple'
  | 'xWing'
  | 'swordfish'
  | 'xyWing';

export const TECHNIQUE_LEVEL: Record<Technique, number> = {
  nakedSingle: 1,
  hiddenSingle: 1,
  intersection: 2,
  nakedPair: 2,
  hiddenPair: 2,
  nakedTriple: 3,
  hiddenTriple: 3,
  xWing: 3,
  swordfish: 3,
  xyWing: 3,
};

export interface Grade {
  /** 1..4, see above. */
  level: number;
  solved: boolean;
  /** How often each technique was applied. */
  uses: Partial<Record<Technique, number>>;
  /** Number of steps that needed level >= 2. */
  advancedSteps: number;
}

class LogicState {
  grid: Grid;
  cands: number[];
  constructor(puzzle: Grid) {
    this.grid = puzzle.slice();
    this.cands = this.grid.map((_, i) => candidatesFor(this.grid, i));
  }
  place(i: number, d: number) {
    this.grid[i] = d;
    this.cands[i] = 0;
    const b = bit(d);
    for (const p of PEERS[i]) this.cands[p] &= ~b;
  }
  /** Remove `mask` from the cell; returns true if anything changed. */
  eliminate(i: number, mask: number): boolean {
    if (this.cands[i] & mask) {
      this.cands[i] &= ~mask;
      return true;
    }
    return false;
  }
  get solved() {
    return this.grid.every((v) => v !== 0);
  }
}

type Step = (s: LogicState) => boolean;

const nakedSingle: Step = (s) => {
  for (let i = 0; i < 81; i++) {
    const m = s.cands[i];
    if (!s.grid[i] && m && (m & (m - 1)) === 0) {
      s.place(i, Math.log2(m));
      return true;
    }
  }
  return false;
};

const hiddenSingle: Step = (s) => {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      let pos = -1;
      let n = 0;
      for (const i of unit) {
        if (s.cands[i] & b) {
          pos = i;
          if (++n > 1) break;
        }
      }
      if (n === 1) {
        s.place(pos, d);
        return true;
      }
    }
  }
  return false;
};

/** Pointing pairs/triples and box/line reduction. */
const intersection: Step = (s) => {
  for (let d = 1; d <= 9; d++) {
    const b = bit(d);
    // Box -> line
    for (const box of BOXES) {
      const cells = box.filter((i) => s.cands[i] & b);
      if (cells.length < 2) continue;
      const r = rowOf(cells[0]);
      const c = colOf(cells[0]);
      let changed = false;
      if (cells.every((i) => rowOf(i) === r)) {
        for (const i of ROWS[r]) if (!box.includes(i)) changed = s.eliminate(i, b) || changed;
      } else if (cells.every((i) => colOf(i) === c)) {
        for (const i of COLS[c]) if (!box.includes(i)) changed = s.eliminate(i, b) || changed;
      }
      if (changed) return true;
    }
    // Line -> box
    for (const line of [...ROWS, ...COLS]) {
      const cells = line.filter((i) => s.cands[i] & b);
      if (cells.length < 2) continue;
      const bx = boxOf(cells[0]);
      if (!cells.every((i) => boxOf(i) === bx)) continue;
      let changed = false;
      for (const i of BOXES[bx]) if (!line.includes(i)) changed = s.eliminate(i, b) || changed;
      if (changed) return true;
    }
  }
  return false;
};

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

const nakedSubset = (k: number): Step => (s) => {
  for (const unit of UNITS) {
    const open = unit.filter((i) => !s.grid[i] && popcount(s.cands[i]) <= k);
    if (open.length < k) continue;
    for (const combo of combinations(open, k)) {
      const union = combo.reduce((m, i) => m | s.cands[i], 0);
      if (popcount(union) !== k) continue;
      let changed = false;
      for (const i of unit) if (!combo.includes(i) && !s.grid[i]) changed = s.eliminate(i, union) || changed;
      if (changed) return true;
    }
  }
  return false;
};

const hiddenSubset = (k: number): Step => (s) => {
  for (const unit of UNITS) {
    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) {
      const n = unit.filter((i) => s.cands[i] & bit(d)).length;
      if (n >= 2 && n <= k) digits.push(d);
    }
    if (digits.length < k) continue;
    for (const combo of combinations(digits, k)) {
      const mask = combo.reduce((m, d) => m | bit(d), 0);
      const cells = unit.filter((i) => s.cands[i] & mask);
      if (cells.length !== k) continue;
      let changed = false;
      for (const i of cells) changed = s.eliminate(i, ~mask & 0x3fe) || changed;
      if (changed) return true;
    }
  }
  return false;
};

/** X-Wing (n=2) and Swordfish (n=3), on rows and columns. */
const fish = (n: number): Step => (s) => {
  for (let d = 1; d <= 9; d++) {
    const b = bit(d);
    for (const [base, cover, coverIndex] of [
      [ROWS, COLS, colOf],
      [COLS, ROWS, rowOf],
    ] as const) {
      const lines: { idx: number; mask: number }[] = [];
      base.forEach((line, idx) => {
        let mask = 0;
        for (const i of line) if (s.cands[i] & b) mask |= 1 << coverIndex(i);
        const c = popcount(mask);
        if (c >= 2 && c <= n) lines.push({ idx, mask });
      });
      if (lines.length < n) continue;
      for (const combo of combinations(lines, n)) {
        const union = combo.reduce((m, l) => m | l.mask, 0);
        if (popcount(union) !== n) continue;
        const baseIdx = new Set(combo.map((l) => l.idx));
        let changed = false;
        for (let c = 0; c < 9; c++) {
          if (!(union & (1 << c))) continue;
          cover[c].forEach((i, pos) => {
            if (!baseIdx.has(pos)) changed = s.eliminate(i, b) || changed;
          });
        }
        if (changed) return true;
      }
    }
  }
  return false;
};

const xyWing: Step = (s) => {
  const bivalue = [];
  for (let i = 0; i < 81; i++) if (!s.grid[i] && popcount(s.cands[i]) === 2) bivalue.push(i);
  for (const pivot of bivalue) {
    const pm = s.cands[pivot];
    const wings = bivalue.filter((w) => sees(pivot, w) && popcount(s.cands[w] & pm) === 1);
    for (let a = 0; a < wings.length; a++) {
      for (let c = a + 1; c < wings.length; c++) {
        const w1 = wings[a];
        const w2 = wings[c];
        const m1 = s.cands[w1];
        const m2 = s.cands[w2];
        if ((m1 & pm) === (m2 & pm)) continue; // must share different pivot digits
        const z = m1 & m2 & ~pm;
        if (!z || popcount(z) !== 1) continue;
        if ((m1 | m2 | pm) !== (pm | z)) continue;
        let changed = false;
        for (let i = 0; i < 81; i++) {
          if (i === pivot || i === w1 || i === w2) continue;
          if (sees(i, w1) && sees(i, w2)) changed = s.eliminate(i, z) || changed;
        }
        if (changed) return true;
      }
    }
  }
  return false;
};

const STEPS: [Technique, Step][] = [
  ['nakedSingle', nakedSingle],
  ['hiddenSingle', hiddenSingle],
  ['intersection', intersection],
  ['nakedPair', nakedSubset(2)],
  ['hiddenPair', hiddenSubset(2)],
  ['nakedTriple', nakedSubset(3)],
  ['hiddenTriple', hiddenSubset(3)],
  ['xWing', fish(2)],
  ['swordfish', fish(3)],
  ['xyWing', xyWing],
];

/**
 * Grade a puzzle. `maxLevel` lets callers stop early (e.g. "is this solvable with singles?").
 */
export function grade(puzzle: Grid, maxLevel = 3, verifyAgainst?: Grid): Grade {
  const s = new LogicState(puzzle);
  const uses: Grade['uses'] = {};
  let level = 1;
  let advancedSteps = 0;
  const steps = STEPS.filter(([t]) => TECHNIQUE_LEVEL[t] <= maxLevel);
  outer: while (!s.solved) {
    for (const [name, step] of steps) {
      if (step(s)) {
        if (verifyAgainst) verify(s, verifyAgainst, name);
        uses[name] = (uses[name] ?? 0) + 1;
        const l = TECHNIQUE_LEVEL[name];
        if (l > level) level = l;
        if (l >= 2) advancedSteps++;
        continue outer;
      }
    }
    return { level: 4, solved: false, uses, advancedSteps };
  }
  return { level, solved: true, uses, advancedSteps };
}

/** Test helper: a logical step must never remove the true digit or place a wrong one. */
function verify(s: LogicState, solution: Grid, technique: Technique) {
  for (let i = 0; i < 81; i++) {
    const ok = s.grid[i] ? s.grid[i] === solution[i] : (s.cands[i] & bit(solution[i])) !== 0;
    if (!ok) throw new Error(`${technique} made an invalid deduction at cell ${i}`);
  }
}
