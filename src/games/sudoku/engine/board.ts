/** Board geometry helpers shared by solver, grader and UI. A grid is 81 numbers, 0 = empty. */
export type Grid = number[];

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** 27 units: 9 rows, 9 columns, 9 boxes. */
export const ROWS: number[][] = [];
export const COLS: number[][] = [];
export const BOXES: number[][] = [];
for (let n = 0; n < 9; n++) {
  ROWS.push([]);
  COLS.push([]);
  BOXES.push([]);
}
for (let i = 0; i < 81; i++) {
  ROWS[rowOf(i)].push(i);
  COLS[colOf(i)].push(i);
  BOXES[boxOf(i)].push(i);
}
export const UNITS: number[][] = [...ROWS, ...COLS, ...BOXES];

/** The 20 peers of each cell (same row, column or box). */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const set = new Set<number>([...ROWS[rowOf(i)], ...COLS[colOf(i)], ...BOXES[boxOf(i)]]);
  set.delete(i);
  return [...set];
});

export const sees = (a: number, b: number) =>
  a !== b && (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b));

export const ALL = 0x3fe; // bits 1..9
export const bit = (d: number) => 1 << d;

export function popcount(m: number): number {
  let c = 0;
  while (m) {
    m &= m - 1;
    c++;
  }
  return c;
}

export function digitsOf(m: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (m & (1 << d)) out.push(d);
  return out;
}

/** Candidate mask for a cell given current values (0 if filled). */
export function candidatesFor(grid: Grid, i: number): number {
  if (grid[i]) return 0;
  let m = ALL;
  for (const p of PEERS[i]) if (grid[p]) m &= ~bit(grid[p]);
  return m;
}

export function toString(grid: Grid): string {
  return grid.map((v) => (v ? String(v) : '.')).join('');
}

export function fromString(s: string): Grid {
  return [...s].map((c) => (c >= '1' && c <= '9' ? Number(c) : 0));
}
