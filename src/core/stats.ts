import { defineStore, gameKey, Store } from './storage';
import { DailyEntry, DailyRecord } from './daily';

/** One finished (or abandoned) game. */
export interface GameResult {
  /** Epoch ms when the game ended. */
  at: number;
  outcome: 'won' | 'lost' | 'abandoned';
  timeMs: number;
  /** Assists used (hints etc.). Assisted wins never count for best time. */
  assists: number;
}

export interface ModeStats {
  played: number;
  won: number;
  bestTimeMs: number | null;
  /** Sum of winning times, for the average. */
  winTimeTotalMs: number;
  currentStreak: number;
  bestStreak: number;
  /** Most recent results, newest last. */
  history: GameResult[];
}

/** mode id (difficulty, "daily", …) → stats */
export type StatsByMode = Record<string, ModeStats>;

export interface StatsMode {
  /** Permanent id, part of stored data. Never rename. */
  id: string;
  label: string;
}

const HISTORY = 30;

export const emptyModeStats = (): ModeStats => ({
  played: 0,
  won: 0,
  bestTimeMs: null,
  winTimeTotalMs: 0,
  currentStreak: 0,
  bestStreak: 0,
  history: [],
});

/** Pure update, exported for tests. */
export function applyResult(prev: ModeStats, r: GameResult): { stats: ModeStats; newBest: boolean } {
  const s: ModeStats = { ...prev, history: [...prev.history, r].slice(-HISTORY) };
  s.played++;
  let newBest = false;
  if (r.outcome === 'won') {
    s.won++;
    s.winTimeTotalMs += r.timeMs;
    s.currentStreak++;
    s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
    if (r.assists === 0 && (s.bestTimeMs == null || r.timeMs < s.bestTimeMs)) {
      newBest = s.bestTimeMs != null; // only "new" if there was one to beat
      s.bestTimeMs = r.timeMs;
    }
  } else {
    s.currentStreak = 0;
  }
  return { stats: s, newBest };
}

/**
 * Statistics of one game: per-mode results (games/game/<id>/stats) and, optionally,
 * daily challenge completions (games/game/<id>/daily).
 *
 * The generic Statistics screen, the "reset statistics" button and backups all work through
 * this object, so a game gets them for free by creating one.
 */
export interface GameStats {
  gameId: string;
  modes: StatsMode[];
  store: Store<StatsByMode>;
  daily: Store<DailyRecord> | null;
  get(mode: string): ModeStats;
  record(mode: string, result: Omit<GameResult, 'at'>): { newBest: boolean };
  /** Record a daily completion (first completion per day counts). */
  markDaily(date: string, entry: DailyEntry): void;
  reset(): void;
}

export function createGameStats(gameId: string, opts: { modes: StatsMode[]; daily?: boolean }): GameStats {
  const store = defineStore<StatsByMode>({ key: gameKey(gameId, 'stats'), version: 1, initial: {} });
  const daily = opts.daily ? defineStore<DailyRecord>({ key: gameKey(gameId, 'daily'), version: 1, initial: {} }) : null;
  return {
    gameId,
    modes: opts.modes,
    store,
    daily,
    get: (mode) => store.get()[mode] ?? emptyModeStats(),
    record(mode, result) {
      const res = applyResult(store.get()[mode] ?? emptyModeStats(), { ...result, at: Date.now() });
      store.set((s) => ({ ...s, [mode]: res.stats }));
      return { newBest: res.newBest };
    },
    markDaily(date, entry) {
      daily?.set((d) => (d[date] ? d : { ...d, [date]: entry }));
    },
    reset() {
      store.set({});
      daily?.set({});
    },
  };
}
