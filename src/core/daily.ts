import { persistentStore } from './store';

/** Local calendar date as YYYY-MM-DD. */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + delta));
}

export interface DailyEntry {
  timeMs: number;
  assists: number;
}

/** gameId -> date -> completion */
export type DailyData = Record<string, Record<string, DailyEntry>>;

export const dailyStore = persistentStore<DailyData>('daily', {});

export function markDailyDone(gameId: string, date: string, entry: DailyEntry): void {
  dailyStore.set((data) => {
    if (data[gameId]?.[date]) return data; // first completion counts
    return { ...data, [gameId]: { ...data[gameId], [date]: entry } };
  });
}

/** Consecutive days solved, ending today (or yesterday if today isn't solved yet). */
export function dailyStreak(done: Record<string, DailyEntry> | undefined, today = todayKey()): number {
  if (!done) return 0;
  let day = done[today] ? today : addDays(today, -1);
  let n = 0;
  while (done[day]) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestDailyStreak(done: Record<string, DailyEntry> | undefined): number {
  if (!done) return 0;
  const days = Object.keys(done).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
