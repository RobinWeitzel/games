import { GridAction, GridEvent, GridRules, NumberGrid, isEditable, reduceGrid, restartGrid } from '../../core/numberGrid';
import { Difficulty, Puzzle, Run, puzzleRuns } from './engine';

/**
 * Kakuro game logic. The play logic (digits, notes, mistakes, undo, hints) is shared with other
 * number grids in core/numberGrid.ts; this file adds the black clue cells and the runs.
 *
 * The whole KakuroGame object is persisted (games/game/kakuro/save, schema v1), so changing its
 * shape needs a version bump and a migration (docs/STORAGE.md).
 */

export type KakuroMode = Difficulty | 'daily';

export interface KakuroGame extends NumberGrid {
  mode: KakuroMode;
  difficulty: Difficulty;
  /** Daily challenge date (YYYY-MM-DD). */
  date?: string;
  /** Grid width and height (`size` is the number of digits, 9). */
  n: number;
  /** Clue sums of the black cells (0 = no run). Black cells have solution 0. */
  across: number[];
  down: number[];
  elapsedMs: number;
}

export type Action = GridAction;
export type Event = GridEvent;
export { isEditable };

export const isWhite = (g: KakuroGame, i: number) => g.solution[i] > 0;

export function newGame(p: Puzzle & { mode: KakuroMode; difficulty: Difficulty; date?: string }): KakuroGame {
  return {
    mode: p.mode,
    difficulty: p.difficulty,
    ...(p.date ? { date: p.date } : {}),
    size: 9,
    n: p.n,
    solution: p.solution,
    across: p.across,
    down: p.down,
    values: new Array(p.n * p.n).fill(0),
    notes: new Array(p.n * p.n).fill(0),
    selected: null,
    notesMode: false,
    mistakes: 0,
    hints: 0,
    elapsedMs: 0,
    status: 'playing',
    touched: false,
    undo: [],
  };
}

const runsCache = new WeakMap<number[], Run[]>();
/** The runs of the puzzle (cached per puzzle). */
export function runs(g: KakuroGame): Run[] {
  let r = runsCache.get(g.solution);
  if (!r) runsCache.set(g.solution, (r = puzzleRuns(g)));
  return r;
}

/** The across and down run through a white cell. */
export function runsOf(g: KakuroGame, cell: number): { across: Run | undefined; down: Run | undefined } {
  const all = runs(g).filter((r) => r.cells.includes(cell));
  return { across: all.find((r) => r.dir === 'across'), down: all.find((r) => r.dir === 'down') };
}

export function progress(g: KakuroGame): number {
  let whites = 0;
  let right = 0;
  g.solution.forEach((d, i) => {
    if (!d) return;
    whites++;
    if (g.values[i] === d) right++;
  });
  return whites ? right / whites : 0;
}

function rules(g: KakuroGame): GridRules {
  const cellsOf = (cell: number) => {
    const { across, down } = runsOf(g, cell);
    return [...new Set([...(across?.cells ?? []), ...(down?.cells ?? [])])];
  };
  return {
    peers: (cell) => cellsOf(cell).filter((c) => c !== cell),
    group: cellsOf,
    // Black cells are never open; the cell whose runs are closest to finished first.
    hintOrder: (open) => {
      const white = open.filter((c) => isWhite(g, c));
      const left = (cell: number) => cellsOf(cell).filter((c) => white.includes(c)).length;
      return white.sort((a, b) => left(a) - left(b) || a - b);
    },
  };
}

/** Apply an action. Black cells can't be selected; arrow keys skip over them. */
export function reduce(g: KakuroGame, action: Action): [KakuroGame, Event] {
  const none: Event = { kind: 'none' };
  if (action.type === 'select' && !isWhite(g, action.cell)) return [g, none];
  if (action.type === 'move') {
    let next = g;
    for (let k = 0; k < g.n * g.n; k++) {
      [next] = reduceGrid(next, action, rules(g));
      if (next.selected != null && isWhite(g, next.selected)) return [next, none];
    }
    return [g, none];
  }
  if ((action.type === 'input' || action.type === 'erase') && (g.selected == null || !isWhite(g, g.selected))) return [g, none];
  if (action.type === 'hint' && g.selected != null && !isWhite(g, g.selected)) return reduceGrid({ ...g, selected: null }, action, rules(g));
  return reduceGrid(g, action, rules(g));
}

/** Start the puzzle over (digits, notes and undo cleared; mistakes, hints and time kept). Same object when there's nothing to clear. */
export const restart = (g: KakuroGame): KakuroGame => restartGrid(g);
