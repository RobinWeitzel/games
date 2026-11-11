/**
 * localStorage exactly as written by the first release (layout 1). Frozen: never edit.
 * Used to prove that upgrading never loses a player's data.
 */
const modeStats = {
  played: 3,
  won: 2,
  bestTimeMs: 300000,
  winTimeTotalMs: 700000,
  currentStreak: 1,
  bestStreak: 2,
  history: [{ at: 1762800000000, outcome: 'won', timeMs: 400000, assists: 0 }],
};

export const savedGameV1 = {
  id: 'abc',
  mode: 'easy',
  difficulty: 'easy',
  puzzle: new Array(81).fill(0),
  solution: new Array(81).fill(1),
  values: new Array(81).fill(0),
  notes: new Array(81).fill(0),
  mistakes: 1,
  hints: 0,
  elapsedMs: 12345,
  status: 'playing',
  selected: 4,
  notesMode: false,
  undo: [],
  touched: true,
};

export const LAYOUT1: Record<string, unknown> = {
  'games:v1:settings': { theme: 'dark', haptics: false, sudoku: { mistakeLimit: false, highlightSame: true, autoRemoveNotes: false } },
  'games:v1:stats': { sudoku: { easy: modeStats, daily: { ...modeStats, played: 1 } } },
  'games:v1:daily': { sudoku: { '2026-11-10': { timeMs: 500000, assists: 0 } } },
  'games:v1:sudoku:save': savedGameV1,
  'games:v1:sudoku:pool': { easy: [{ puzzle: [], solution: [] }] },
  'games:v1:sudoku:daily-cache': { date: '2026-11-11', p: { puzzle: [], solution: [] } },
};

export const MODE_STATS_V1 = modeStats;

export function writeLayout1(): void {
  for (const [k, v] of Object.entries(LAYOUT1)) localStorage.setItem(k, JSON.stringify(v));
}
