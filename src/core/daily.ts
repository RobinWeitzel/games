/** Date helpers for daily challenges (local calendar days, "YYYY-MM-DD"). */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + delta));
}

export interface DailyEntry {
  timeMs: number;
  assists: number;
}

/** date → first successful completion */
export type DailyRecord = Record<string, DailyEntry>;

/** Consecutive days solved, ending today (or yesterday if today isn't solved yet). */
export function dailyStreak(done: DailyRecord | undefined, today = todayKey()): number {
  if (!done) return 0;
  let day = done[today] ? today : addDays(today, -1);
  let n = 0;
  while (done[day]) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestDailyStreak(done: DailyRecord | undefined): number {
  if (!done) return 0;
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of Object.keys(done).sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
