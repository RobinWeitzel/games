import type { Rng } from '../../core/random';

/**
 * Sliding puzzle (15-puzzle) game logic: pure functions only, unit-tested in state.test.ts.
 *
 * Tiles 1…n²-1 and one gap on an n × n board. Tap a tile in the gap's row or column to slide it
 * (and the tiles between) into the gap. Put the tiles in order, the gap last.
 *
 * The whole SlideGame object is persisted (games/game/sliding-puzzle/save, schema v1), so
 * changing its shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type SlideMode = 'size3' | 'size4' | 'size5' | 'daily';

export const UNDO_LIMIT = 1000;

export interface SlideGame {
  mode: SlideMode;
  date?: string;
  n: number;
  /** Tile number per cell, row by row; 0 is the gap. */
  tiles: number[];
  status: 'playing' | 'won';
  /** Tiles moved (a slide of three tiles counts three). */
  moves: number;
  undos: number;
  elapsedMs: number;
  touched: boolean;
  /** Where the gap was before each slide (undo slides it back). */
  history: number[];
}

export type Action = { type: 'tap'; cell: number } | { type: 'undo' };

export type Event = { kind: 'none' } | { kind: 'invalid'; cell: number } | { kind: 'moved'; tiles: number[] } | { kind: 'undone' } | { kind: 'won' };

export const isSolved = (tiles: number[]) => tiles.every((t, i) => t === (i === tiles.length - 1 ? 0 : i + 1));

/** Can this arrangement be put in order? (Half of all arrangements can't.) */
export function isSolvable(tiles: number[], n: number): boolean {
  const seq = tiles.filter((t) => t !== 0);
  let inversions = 0;
  for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) if (seq[i] > seq[j]) inversions++;
  if (n % 2 === 1) return inversions % 2 === 0;
  const gapRowFromBottom = n - Math.floor(tiles.indexOf(0) / n);
  return (inversions + gapRowFromBottom) % 2 === 1;
}

/** A random arrangement that can be solved and isn't nearly solved already. */
export function shuffleTiles(n: number, rng: Rng): number[] {
  for (;;) {
    const tiles = Array.from({ length: n * n }, (_, i) => i);
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    if (!isSolvable(tiles, n)) {
      // Swapping two tiles (not the gap) flips solvability.
      const a = tiles.findIndex((t) => t !== 0);
      const b = tiles.findIndex((t, i) => t !== 0 && i !== a);
      [tiles[a], tiles[b]] = [tiles[b], tiles[a]];
    }
    if (inPlace(tiles) <= Math.floor(n * n * 0.25)) return tiles;
  }
}

/** Tiles already in their final place. */
export const inPlace = (tiles: number[]) => tiles.filter((t, i) => t !== 0 && t === i + 1).length;
export const progress = (g: SlideGame) => inPlace(g.tiles) / (g.n * g.n - 1);

export function newGame(mode: SlideMode, n: number, rng: Rng, date?: string): SlideGame {
  return { mode, ...(date ? { date } : {}), n, tiles: shuffleTiles(n, rng), status: 'playing', moves: 0, undos: 0, elapsedMs: 0, touched: false, history: [] };
}

/** Slide the tiles between `cell` and the gap; null if `cell` isn't in the gap's row or column. */
function slide(tiles: number[], n: number, cell: number): { tiles: number[]; moved: number[] } | null {
  const gap = tiles.indexOf(0);
  if (cell === gap) return null;
  const sameRow = Math.floor(cell / n) === Math.floor(gap / n);
  const sameCol = cell % n === gap % n;
  if (!sameRow && !sameCol) return null;
  const step = sameRow ? Math.sign(cell - gap) : Math.sign(cell - gap) * n;
  const next = tiles.slice();
  const moved: number[] = [];
  for (let p = gap; p !== cell; p += step) {
    next[p] = next[p + step];
    moved.push(next[p]);
  }
  next[cell] = 0;
  return { tiles: next, moved };
}

export function reduce(g: SlideGame, action: Action): [SlideGame, Event] {
  if (g.status !== 'playing') return [g, { kind: 'none' }];
  if (action.type === 'undo') {
    const prev = g.history[g.history.length - 1];
    if (prev == null) return [g, { kind: 'none' }];
    const s = slide(g.tiles, g.n, prev)!;
    return [{ ...g, tiles: s.tiles, history: g.history.slice(0, -1), undos: g.undos + 1, touched: true }, { kind: 'undone' }];
  }
  const s = slide(g.tiles, g.n, action.cell);
  if (!s) return g.tiles[action.cell] === 0 ? [g, { kind: 'none' }] : [g, { kind: 'invalid', cell: action.cell }];
  const next: SlideGame = {
    ...g,
    tiles: s.tiles,
    moves: g.moves + s.moved.length,
    touched: true,
    history: [...g.history, g.tiles.indexOf(0)].slice(-UNDO_LIMIT),
  };
  if (isSolved(s.tiles)) return [{ ...next, status: 'won' }, { kind: 'won' }];
  return [next, { kind: 'moved', tiles: s.moved }];
}
