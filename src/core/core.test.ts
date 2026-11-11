import { describe, expect, it } from 'vitest';
import { applyResult, emptyModeStats } from './stats';
import { bestDailyStreak, dailyStreak } from './daily';
import { formatTime } from './format';

describe('stats', () => {
  it('tracks wins, best time, streaks', () => {
    let s = emptyModeStats();
    let r = applyResult(s, { at: 0, outcome: 'won', timeMs: 5000, assists: 0 });
    expect(r.newBest).toBe(false);
    s = r.stats;
    r = applyResult(s, { at: 0, outcome: 'won', timeMs: 4000, assists: 0 });
    expect(r.newBest).toBe(true);
    s = r.stats;
    s = applyResult(s, { at: 0, outcome: 'won', timeMs: 1000, assists: 2 }).stats; // assisted
    expect(s.bestTimeMs).toBe(4000);
    expect(s.currentStreak).toBe(3);
    s = applyResult(s, { at: 0, outcome: 'lost', timeMs: 1000, assists: 0 }).stats;
    expect(s).toMatchObject({ played: 4, won: 3, currentStreak: 0, bestStreak: 3, winTimeTotalMs: 10000 });
  });
});

describe('daily', () => {
  const e = { timeMs: 1, assists: 0 };
  it('computes streaks across month boundaries', () => {
    const done = { '2026-10-30': e, '2026-10-31': e, '2026-11-01': e, '2026-11-03': e };
    expect(dailyStreak(done, '2026-11-01')).toBe(3);
    expect(dailyStreak(done, '2026-11-02')).toBe(3); // today not yet solved
    expect(dailyStreak(done, '2026-11-04')).toBe(1);
    expect(dailyStreak(done, '2026-11-05')).toBe(0);
    expect(bestDailyStreak(done)).toBe(3);
  });
});

it('formats times', () => {
  expect(formatTime(65_000)).toBe('01:05');
  expect(formatTime(3_725_000)).toBe('1:02:05');
});
