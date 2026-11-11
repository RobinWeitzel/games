import { persistentStore } from './store';

/** One finished (or abandoned) game. */
export interface GameResult {
  /** Epoch ms when the game ended. */
  at: number;
  outcome: 'won' | 'lost' | 'abandoned';
  timeMs: number;
  /** Assists used (hints). Assisted wins don't count for best time. */
  assists: number;
}

export interface ModeStats {
  played: number;
  won: number;
  bestTimeMs: number | null;
  /** Sum and count of winning times, for the average. */
  winTimeTotalMs: number;
  currentStreak: number;
  bestStreak: number;
  /** Most recent results, newest last. */
  history: GameResult[];
}

/** gameId -> mode (e.g. difficulty or "daily") -> stats */
export type StatsData = Record<string, Record<string, ModeStats>>;

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

export const statsStore = persistentStore<StatsData>('stats', {});

export function getModeStats(data: StatsData, gameId: string, mode: string): ModeStats {
  return data[gameId]?.[mode] ?? emptyModeStats();
}

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
      // Only call it a "new best" if there was a previous best to beat.
      newBest = s.bestTimeMs != null;
      s.bestTimeMs = r.timeMs;
    }
  } else {
    s.currentStreak = 0;
  }
  return { stats: s, newBest };
}

export function recordResult(gameId: string, mode: string, result: Omit<GameResult, 'at'>): { newBest: boolean } {
  let newBest = false;
  statsStore.set((data) => {
    const prev = getModeStats(data, gameId, mode);
    const res = applyResult(prev, { ...result, at: Date.now() });
    newBest = res.newBest;
    return { ...data, [gameId]: { ...data[gameId], [mode]: res.stats } };
  });
  return { newBest };
}

export function resetStats(gameId?: string): void {
  statsStore.set((data) => {
    if (!gameId) return {};
    const { [gameId]: _removed, ...rest } = data;
    return rest;
  });
}

/** Combine all modes of a game (for the overview). */
export function totals(data: StatsData, gameId: string): { played: number; won: number } {
  return Object.values(data[gameId] ?? {}).reduce(
    (acc, s) => ({ played: acc.played + s.played, won: acc.won + s.won }),
    { played: 0, won: 0 },
  );
}
